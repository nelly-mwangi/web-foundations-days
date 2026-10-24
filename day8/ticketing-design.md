# TicketHub: Event Ticketing System Design

## 1. Requirements

### 1.1 Functional Requirements

The TicketHub system must allow users to:

- Register, log in, and securely manage their accounts.
- Browse upcoming events and view event details.
- View available seats and their prices.
- Select and temporarily hold seats before payment.
- Pay for held seats and receive booking confirmation.
- View their orders and purchased tickets.
- Automatically release seats when unpaid holds expire.
- Prevent two different users from holding or buying the same seat.

### 1.2 Non-Functional Requirements

- **Performance:** Event pages should load within 2 seconds under normal traffic. Holding a seat should respond within 500 ms, even during a big sale.
- **Correctness:** A seat must not be sold to more than one customer, and a customer must not be charged for a seat they did not get.
- **Fairness:** Popular sales should use a waiting room and queue to control access and reduce automated abuse.
- **Availability:** Users should be able to browse events even when ticket demand is high.
- **Security:** Authentication, authorization, HTTPS, input validation, and secure payment processing must be implemented.
- **Scalability:** The system should handle sudden increases in traffic during popular concert sales.
- **Reliability:** Failed payments and expired holds must not leave seats permanently unavailable.

### 1.3 Non-Goals

- Ticket resale or transfer between users.
- Dynamic pricing.
- Multiple currencies.
- Buying several seats in one order (the first version uses one seat per order; see Risks).

## 2. Traffic Estimates

### 2.1 Normal Traffic

- Registered users: 2,000,000.
- Daily visitors: 50,000.
- Average pages viewed per visitor: 10.
- Tickets sold per day: 5,000.

**Daily page views:** 50,000 visitors x 10 pages = 500,000 page views per day.

**Average page views per second:** 500,000 / 86,400 seconds = about **5.8 requests per second**. Assuming the busiest period is about 5 times the average, the peak is about **29 requests per second**.

**Average ticket sales per second:** 5,000 / 86,400 = about **0.058 purchases per second** (one every 17 seconds).

### 2.2 Popular Concert Sale (Peak)

- People attempting to buy tickets: 200,000.
- Available seats: 20,000.
- Time period: 10 minutes (600 seconds).

**Customers arriving:** 200,000 / 600 = about **333 customers per second** on average. Most arrive at the start, so assume about **1,000 customers per second** in the first minute.

**Total requests:** Each customer loads the event page, refreshes the seat map several times, and tries to hold a seat. Assuming about 5 requests per customer: 200,000 x 5 / 600 = about **1,700 requests per second** on average, and about **5,000 requests per second** at the peak.

**Seat-hold attempts:** Assuming about 3 attempts per customer (many seats are taken before they click): 600,000 / 600 = about **1,000 hold attempts per second**.

**Successful purchases:** 20,000 seats / 600 seconds = about **33 purchases per second**.

**Who gets a seat:** 20,000 / 200,000 = **10%**. The other 90% must be told clearly and quickly that no seats are left.

### 2.3 Comparison

| Measure                       | Normal day | Big sale | Ratio      |
| ----------------------------- | ---------- | -------- | ---------- |
| Requests per second (average) | 5.8        | 1,700    | about 290x |
| Requests per second (peak)    | 29         | 5,000    | about 170x |
| Purchases per second          | 0.058      | 33       | about 570x |

The big sale is **roughly 200 to 600 times heavier** than a normal day, lasts only about 10 minutes, and is focused on **one event and its 20,000 seats**. This leads to two conclusions:

1. We cannot run at full size all the time, so we need caching, a waiting room, and servers that can be added quickly.
2. Many customers compete for the same seat rows, so correctness must be enforced by the database, not by application code alone.

## 3. API Design

All amounts are in **cents** (integers) to avoid rounding errors. Endpoints marked _auth_ require a logged-in user.

### 3.1 Browse Events

**Endpoint:** `GET /events`

Returns a paginated list of upcoming events.

```json
{
  "events": [
    {
      "id": 101,
      "name": "Summer Music Festival",
      "date": "2027-01-15",
      "venue": "City Arena"
    }
  ],
  "page": 1
}
```

Success: `200 OK`.

### 3.2 View Event Details

**Endpoint:** `GET /events/{eventId}`

Returns the venue, date, description, and ticket information. Success: `200 OK`. If the event does not exist: `404 Not Found`.

### 3.3 View Available Seats

**Endpoint:** `GET /events/{eventId}/seats`

```json
{
  "eventId": 101,
  "seats": [
    { "seatId": 501, "priceCents": 2500, "status": "available" },
    { "seatId": 502, "priceCents": 2500, "status": "held" }
  ]
}
```

Success: `200 OK`. The seat map is only a snapshot (it may be cached for 1 to 2 seconds). The backend verifies availability again when a customer tries to hold a seat.

### 3.4 Hold a Seat (_auth_)

**Endpoint:** `POST /events/{eventId}/holds`

Request: `{ "seatId": 501 }`

Response:

```json
{
  "orderId": 9001,
  "status": "held",
  "expiresAt": "2027-01-15T10:15:00Z"
}
```

Success: `201 Created`. A hold lasts five minutes. If the seat is already held or sold: `409 Conflict`. If the user is sending too many requests: `429 Too Many Requests`.

### 3.5 Release a Hold (_auth_)

**Endpoint:** `DELETE /orders/{orderId}/hold`

Releases a hold early so the seat becomes available again. Success: `204 No Content`. If the order is not in the `held` state: `409 Conflict`.

### 3.6 Pay for an Order (_auth_)

**Endpoint:** `POST /orders/{orderId}/payment`

```json
{
  "paymentMethod": "card",
  "idempotencyKey": "payment-9001-attempt-1"
}
```

Possible responses:

- `200 OK`: payment completed.
- `202 Accepted`: payment is still being processed.
- `409 Conflict`: the hold expired or the order cannot be paid.
- `502 Bad Gateway`: the payment provider could not be reached.

The idempotency key means retries or double-clicks never create duplicate charges or tickets.

### 3.7 View Purchased Tickets (_auth_)

**Endpoint:** `GET /tickets`

Returns only the authenticated user's tickets. Success: `200 OK`.

### 3.8 View an Order (_auth_)

**Endpoint:** `GET /orders/{orderId}`

Returns the order status, event, seat, payment status, and hold expiry when applicable. Success: `200 OK`. If the order does not exist or belongs to another user, the API returns `404 Not Found` without exposing private information.

### 3.9 API Error Handling

- `400 Bad Request`: invalid input.
- `401 Unauthorized`: the user is not authenticated.
- `403 Forbidden`: the user lacks permission.
- `404 Not Found`: the resource does not exist.
- `409 Conflict`: the seat is unavailable or the order state prevents the action.
- `429 Too Many Requests`: the client exceeded its rate limit.
- `500 Internal Server Error`: an unexpected server error.

## 4. Data Model

TicketHub uses a relational database such as PostgreSQL because orders, seats, and payments need reliable relationships and transactions.

### 4.1 Main Tables

| Table      | Purpose                                         |
| ---------- | ----------------------------------------------- |
| `users`    | Registered customer accounts.                   |
| `events`   | Event details, dates, venues, and descriptions. |
| `seats`    | Seats for each event, with price and status.    |
| `orders`   | Seat holds and customer purchase orders.        |
| `payments` | Payment attempts and their statuses.            |
| `tickets`  | Tickets issued for paid orders.                 |

### 4.2 Relationships

- One user has many orders.
- One event has many seats and many orders.
- Each seat belongs to one event.
- Each order belongs to one user and one event, and references one seat.
- One order can have many payment attempts.
- A paid order has one ticket.

### 4.3 Schema

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    description TEXT
);

CREATE TABLE seats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id),
    seat_number VARCHAR(50) NOT NULL,
    price_cents INT NOT NULL CHECK (price_cents >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'held', 'sold')),

    UNIQUE (event_id, seat_number),
    UNIQUE (id, event_id)
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    event_id BIGINT NOT NULL REFERENCES events(id),
    seat_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN (
            'held', 'pending_payment', 'paid',
            'expired', 'cancelled', 'failed'
        )),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (seat_id, event_id)
        REFERENCES seats(id, event_id)
);

CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    provider_reference VARCHAR(255) UNIQUE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    amount_cents INT NOT NULL CHECK (amount_cents >= 0),
    status VARCHAR(20) NOT NULL
        CHECK (status IN (
            'pending', 'succeeded', 'failed', 'refunded'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
    ticket_code VARCHAR(255) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

To prevent two active orders for the same seat, add a partial unique index:

```sql
CREATE UNIQUE INDEX one_active_order_per_seat
ON orders (seat_id)
WHERE status IN ('held', 'pending_payment', 'paid');
```

Other useful indexes: `seats (event_id, status)` for the seat map, and `orders (user_id)` for "my orders".

### 4.4 Preventing Double-Booking

Double-booking happens when two customers try to get the same seat at almost the same time. We do **not** check "is it free?" in application code and then save, because two requests could both pass the check before either saves. Instead, the **database decides**, using transactions, row locking, and constraints.

**Step 1: Holding a seat.** The backend runs one transaction:

1. `BEGIN`.
2. Lock the seat row: `SELECT * FROM seats WHERE id = :seat_id FOR UPDATE`. A second request for the same seat waits here until the first finishes.
3. If the seat is `held` and its hold has expired, first mark the old order `expired` (`UPDATE orders SET status = 'expired' WHERE seat_id = :seat_id AND status = 'held' AND hold_expires_at < NOW()`) and set the seat to `available`. This must happen **before** step 4, otherwise the partial unique index would still see the old order as active and reject the new one. If the old order is `pending_payment`, do **not** release the seat; its payment must be reconciled first.
4. If the seat is `available`, insert the new `held` order with `hold_expires_at = NOW() + 5 minutes` and set the seat to `held`.
5. If the seat is not available, `ROLLBACK` and return `409 Conflict`.
6. `COMMIT`.

When the second request finally gets the lock, it re-reads the row, sees `held`, and fails. Exactly one customer wins.

**Step 2: Paying.** In one transaction, the backend verifies that the order is still `held` (or `pending_payment`), belongs to the user, and has not expired. The payment provider is charged using the idempotency key. When payment succeeds, the backend sets the order to `paid`, the seat to `sold`, and creates the ticket. If the transaction fails after a successful charge, the reconciliation job refunds the payment.

**Step 3: Constraints as a last line of defence.** Even if the application code has a bug, `one_active_order_per_seat` makes it impossible for two active orders to reference the same seat, and `UNIQUE (event_id, seat_number)` prevents duplicate seat rows. The database refuses the second insert.

**Important:** The seat status and order status are always updated together in the same transaction. A background worker expires unpaid holds using the same safe logic as step 3 above, never by simply changing the seat status alone.

## 5. High-Level Architecture

### 5.1 Architecture Diagram

```text
                       Customers
                           |
                           v
                  CDN / Web Frontend
                           |
                           v
                 Waiting Room / Queue
                           |
                           v
                    Load Balancer
                           |
                 +---------+---------+
                 |                   |
                 v                   v
          App Server 1   ...    App Server N     (stateless)
                 |                   |
                 +----+---------+----+
                      |         |
                      v         v
                Redis cache   PostgreSQL primary --> Read replicas
                                  ^
                                  |
        App Servers <----> Payment Provider
                  (charge request, then webhook result)

        Background Worker --> PostgreSQL
        (expire holds, reconcile payments, send emails)
```

### 5.2 Component Explanations

**1. CDN and Web Frontend.** The frontend shows events, seats, checkout, and tickets. The CDN serves static files (images, CSS, JavaScript) from servers close to customers, which removes much of the traffic before it reaches the backend.

**2. Waiting Room / Queue.** During a popular sale, customers enter a virtual waiting room, and a controlled number are admitted at a time (for example, 100 to 300 per second). This protects the application and database from the 1,000 customers per second spike. Admission is first-in-first-out where practical, with signed queue tokens to reduce bypassing and bots.

**3. Load Balancer.** Spreads requests across application servers and avoids unhealthy ones, so no single server is a point of failure.

**4. Application Servers.** Handle authentication, browsing, holds, orders, and tickets. They are stateless (sessions are stored in tokens or Redis), so more servers can be added or removed as traffic changes.

**5. Redis Cache.** Stores event descriptions, a short-lived (1 to 2 second) copy of each seat map, rate-limit counters, and queue state. This turns thousands of seat-map reads per second into about one database read per second. Cached seat availability is informational only; the database remains the source of truth when holding or buying a seat.

**6. PostgreSQL Primary Database.** Stores users, events, seats, orders, payments, and tickets. All seat holds and purchases go to the primary so that row locking and constraints work reliably. About 1,000 hold attempts per second of short single-row transactions is within what one primary can handle.

**7. Read Replicas.** Serve browsing and "my tickets" queries, and can take over if the primary fails. Because replicas can lag slightly, they are never used for final seat decisions.

**8. Payment Provider.** Processes payments securely so card details are never stored in TicketHub. The app servers send charge requests, and the provider sends the result back by webhook. The application verifies each result and records it idempotently.

**9. Background Worker.** Expires unpaid holds safely, reconciles late or uncertain payment results, retries safe tasks, and sends ticket emails, all outside the customer's request path.

### 5.3 Surviving a Popular Concert Sale

1. The CDN absorbs static traffic.
2. The waiting room flattens the spike into a steady flow.
3. Extra application servers are started before the sale begins.
4. Cached event data and seat maps protect the database from read floods.
5. Rate limits (for example, 10 hold attempts per minute per user) stop bots and spam.
6. Only short hold and purchase transactions reach the primary database.
7. The background worker releases expired holds so seats return to sale.
8. Customers get clear "seat taken" and "sold out" messages.

The waiting room reduces pressure but does not replace database locking and constraints, because simultaneous requests can still reach different application servers.

## 6. Trade-Offs and Design Decisions

### 6.1 Fairness vs. Speed

A waiting room makes some customers wait before they can buy. However, it prevents a surge from crashing the system and gives a more orderly sale.

**Decision:** Use a waiting room for high-demand events only, and let normal browsing happen without a queue when traffic is manageable.

### 6.2 Strong Consistency vs. Performance

Caching seat maps reduces database load but may show a seat as free for a second or two after it was taken.

**Decision:** Cache event information and seat maps briefly, but always verify availability in the database when creating a hold or confirming a purchase. The worst case is a `409` and a refresh, never a double sale.

### 6.3 Cost vs. Availability

Multiple servers and replicas improve resilience and read capacity but increase cost and maintenance. Replicas may lag, so they cannot make final seat decisions.

**Decision:** Start with a primary database and several application servers. Add replicas and more infrastructure when measurements show they are needed.

### 6.4 Seat Availability vs. Reservation Convenience

Longer holds give customers more time to pay but keep seats away from others. Shorter holds improve turnover but can frustrate slow payers.

**Decision:** Use a five-minute hold with a visible countdown. If a payment is still processing, reconcile it before releasing the seat so it is never sold twice.

### 6.5 Database Locking vs. a Redis Lock

A Redis lock could be faster, but it adds a second system that can disagree with the database (for example, if the lock expires mid-request).

**Decision:** Use the database as the single authority for seats. The cost is that all seat writes go through one primary, which our estimate (about 1,000 writes per second) shows is acceptable. If load grew much further, seats could be partitioned by `event_id`, since different events do not compete.

### 6.6 Simplicity vs. Scalability

A modular backend with PostgreSQL is easy to build and test. Extra services scale further but add operational complexity.

**Decision:** Begin simple and add specialized services only when traffic or measured bottlenecks justify them.

## 7. Risks and Open Questions

- **Payment succeeds but the server crashes before saving.** Mitigation: idempotency keys, plus a reconciliation job that matches provider payments to orders and refunds unmatched ones.
- **Bots may bypass simple rate limits.** Open question: should big sales require verified accounts or CAPTCHA?
- **One seat per order.** Families cannot buy several seats together in one checkout. A future version could allow multi-seat orders with an `order_items` table, holding all seats in one transaction (all or none).
- **The waiting room is a new component that must not fail.** It should be load-tested before real sales.

## 8. Conclusion

TicketHub supports normal event browsing and high-demand concert sales while protecting customers from duplicate bookings. It uses a relational database for reliable transactions, a waiting room to manage sudden demand, caching to reduce database reads, and background processing to release expired holds.

The most important design principle is that **seat availability must be verified and changed atomically in the database**. Traffic controls improve performance and fairness, but database transactions and constraints protect purchase correctness.
