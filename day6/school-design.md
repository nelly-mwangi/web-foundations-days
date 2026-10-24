# School Database Design

## 1. Tables

### Students

The students table stores information about students. It contains a student ID, name, and email address. The student ID is the primary key, and the email address must be unique so that two students cannot register using the same email.

### Courses

The courses table stores information about the courses offered by the school. It contains a course ID and course name. The course ID is the primary key, and each course name must be unique.

### Enrolments

The enrolments table records which students are enrolled in which courses and the grade they receive. It contains an enrolment ID, student ID, course ID, and grade. The student ID and course ID are foreign keys referencing the students and courses tables. A unique constraint on student ID and course ID prevents a student from enrolling in the same course more than once.

## 2. Relationships

### One-to-Many

A student can have many enrolments, but each enrolment belongs to one student. This creates a one-to-many relationship between students and enrolments.

A course can also have many enrolments, but each enrolment belongs to one course. This creates a one-to-many relationship between courses and enrolments.

### Many-to-Many

Students and courses have a many-to-many relationship because one student can take several courses, and one course can have several students.

The enrolments table is needed as a join table to connect students and courses. It also stores additional information about the relationship, such as the student's grade.

## 3. Index

I would add an index on `enrolments(course_id)` to help the database find all enrolments for a particular course more efficiently. This can improve queries that list students on a course or count the students enrolled in each course.

## 4. SQL or NoSQL?

I would choose a relational SQL database such as SQLite for this school system. Students, courses, and enrolments have clear relationships, and the system needs to maintain data integrity through primary keys, foreign keys, and unique constraints. SQL also makes it easy to join tables, count enrolments, and update grades. A NoSQL database could be useful for flexible or rapidly changing data structures, but a relational database is a better fit for this structured school system.
