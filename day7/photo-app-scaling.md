# SnapShare: Photo-Sharing App Scaling Plan

## 1. Assumptions

This plan uses the following assumptions:

- SnapShare has 10 million registered users.
- 10% of registered users are active daily.
- Each daily active user uploads one photo per day.
- Each daily active user views 50 feed pages per day.
- Each original photo is 2 MB, and each thumbnail is 50 KB.
- The system operates 24 hours per day, with activity distributed evenly when calculating average request rates.
- Peak traffic is estimated at five times the average traffic.
- There are 365 days in a year.
- Storage calculations use decimal units: 1 TB = 1,000 GB and 1 GB = 1,000 MB. Storage estimates exclude backups, replicas, metadata, and future user growth.
- Each uploaded photo produces one thumbnail.

## 2. Traffic and Storage Estimates

### Daily Active Users

Daily active users (DAU) are calculated as:

10,000,000 registered users × 10% = 1,000,000 daily active users.

### Photo Uploads per Second

Each daily active user uploads one photo per day.

Daily uploads = 1,000,000 × 1 = 1,000,000 uploads.

Average uploads per second = 1,000,000 ÷ 86,400 = approximately 11.57 uploads per second.

Peak uploads per second = 11.57 × 5 = approximately 57.87 uploads per second.

### Feed Views per Second

Each daily active user views 50 feed pages per day.

Daily feed views = 1,000,000 × 50 = 50,000,000 feed views.

Average feed views per second = 50,000,000 ÷ 86,400 = approximately 578.70 feed views per second.

Peak feed views per second = 578.70 × 5 = approximately 2,893.52 feed views per second.

### Annual Storage Requirements

Original photo storage per day:

1,000,000 photos × 2 MB = 2,000,000 MB = 2 TB.

Original photo storage per year:

2 TB × 365 = 730 TB.

Thumbnail storage per day:

1,000,000 thumbnails × 50 KB = 50,000,000 KB = 50 GB.

Thumbnail storage per year:

50 GB × 365 = 18.25 TB.

Total annual storage for original photos and thumbnails:

730 TB + 18.25 TB = 748.25 TB per year.

This estimate excludes backups, additional replicas, metadata, and storage overhead.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a read-heavy system because users view 50 feed pages per day but upload only one photo per day. This creates approximately 50 feed views for every upload, so the architecture must prioritize fast feed delivery and efficient read handling. A CDN, caching, and database read replicas can reduce the load on application servers and the primary database. The upload path must still be reliable and able to handle peak traffic.

## 4. Why Photos Should Use Object Storage

Photos should be stored in object storage rather than directly inside the database. Image files are large, and storing them in database rows would increase database size, backup costs, and the work required to transfer and retrieve data. Object storage is designed to store large files efficiently and can scale to accommodate hundreds of terabytes. The database should store photo metadata, ownership, timestamps, and object-storage keys or URLs, while the actual original photos and thumbnails are stored in object storage.

## 5. Architecture Diagram

The following diagram shows the main components and how requests flow through SnapShare.

                         USERS
                           |
                           v
                    +--------------+
                    |     CDN      |
                    +--------------+
                           |
                           v
                    +--------------+
                    | Load Balancer|
                    +--------------+
                           |
                           v
                  +-------------------+
                  |   App Servers     |
                  | (Multiple copies) |
                  +-------------------+
                     |       |      |
                     |       |      +-------------------+
                     |       |                          |
                     v       v                          v
                +---------+  +----------------+   +--------------+
                |  Cache  |  | Primary        |   | Object       |
                |         |  | Database       |   | Storage      |
                +---------+  +----------------+   | Originals &  |
                     ^              |              | Thumbnails   |
                     |              v              +--------------+
                     |       +----------------+
                     +-------| Read Replica   |
                             +----------------+

Photo upload and thumbnail processing:

     App Servers
          |
          v

+----------------+
| Object Storage |
| Original Photo |
+----------------+
|
v
+----------------+
| Message Queue |
+----------------+
|
v
+----------------+
| Thumbnail |
| Worker |
+----------------+
|
v
+----------------+
| Object Storage |
| Thumbnail |
+----------------+

The app servers also save photo metadata to the primary database. The primary database replicates data to the read replica, which serves suitable read queries. The cache can be used for frequently requested feed data and metadata.

## 6. What Each Component Solves

- **CDN:** Delivers frequently requested photos from locations closer to users, reducing latency and the load on origin storage.
- **Load balancer:** Distributes incoming requests across multiple app servers to avoid overloading one server and improve availability.
- **App servers:** Handle application logic, authentication, upload requests, feed generation, and interactions with storage and databases.
- **Cache:** Keeps frequently requested feed data and metadata in fast memory to reduce repeated database queries.
- **Primary database:** Stores structured information such as users, follow relationships, photo metadata, and ownership, and handles writes.
- **Read replica:** Serves suitable read queries so feed requests do not overwhelm the primary database.
- **Object storage:** Stores original photos and thumbnails durably without filling the database with large binary files.
- **Message queue:** Holds thumbnail-generation jobs so uploads can complete without waiting for image processing.
- **Thumbnail worker:** Processes queued jobs in the background, creates smaller image versions, and saves them to object storage.

## 7. Photo Upload Flow

1. A user selects a photo and submits an upload request to SnapShare.
2. The load balancer directs the request to an available app server.
3. The app server authenticates the user and validates the file type, size, and upload permissions.
4. The original photo is stored in object storage, using a unique object key.
5. The app server saves the photo metadata, ownership, timestamp, and object key in the primary database.
6. The app server adds a thumbnail-generation job to the message queue.
7. SnapShare confirms the successful upload to the user once the original photo and required metadata have been saved and the job has been queued.
8. A thumbnail worker retrieves the job from the queue and generates a smaller version of the original photo.
9. The worker saves the thumbnail to object storage and updates the photo metadata with the thumbnail's object key or status.
10. When users view the photo in their feeds, the CDN serves the thumbnail or original image as appropriate, while the application retrieves feed metadata from the cache or a database read replica.

If thumbnail processing fails, the job can be retried, and the original photo remains available. The system should monitor failed jobs and avoid creating duplicate thumbnails when a job is retried.

## 8. Trade-Offs

### Trade-Off 1: Caching Versus Freshness

Caching feed data reduces database load and improves response times, but cached information can become stale when a user uploads a photo, changes a follow relationship, or deletes content. SnapShare should use expiration times and cache invalidation for important updates. This introduces additional complexity but improves read performance.

### Trade-Off 2: Read Replicas Versus Immediate Consistency

Read replicas spread database read traffic and help the system handle large numbers of feed requests. However, replication can lag behind the primary database, meaning a newly uploaded photo might not immediately appear in every feed. SnapShare can read recently changed data from the primary database when immediate consistency is required, accepting the additional load.

### Trade-Off 3: Asynchronous Thumbnails Versus Immediate Availability

Generating thumbnails in the background makes uploads faster and keeps image processing from blocking app servers. However, a thumbnail may not be ready immediately after an upload, and a backed-up queue can delay processing. SnapShare should monitor queue depth, retry failed jobs, and display a temporary placeholder until the thumbnail is available.

### Trade-Off 4: Object Storage Versus Operational Simplicity

Object storage scales well for large image collections and separates media storage from database workloads. However, the application must manage object keys, access permissions, deletion, and consistency between database metadata and stored files. This adds operational complexity but is more suitable for the expected storage volume.

## 9. Conclusion

SnapShare is expected to serve one million daily active users, handle approximately 11.57 average photo uploads per second, and process approximately 578.70 average feed views per second. Peak feed traffic could reach approximately 2,893.52 views per second. Original photos and thumbnails will require approximately 748.25 TB of additional storage per year before backups and other overheads.

A scalable design uses a CDN, load balancer, multiple app servers, caching, a primary database with a read replica, object storage, a message queue, and thumbnail workers. This architecture separates media delivery, database operations, and background processing so that each part can scale according to its workload.
