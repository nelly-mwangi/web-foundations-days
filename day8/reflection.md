# Day 8 Reflection

The most difficult concept in this course was understanding how to design a system that handles many requests at the same time without causing errors. In my TicketHub project, I learned that two customers could attempt to purchase the same seat simultaneously, resulting in double-booking. I overcame this challenge by breaking the problem into smaller parts and learning how database transactions, row locking, and unique constraints work together to protect seat availability. I also learned that caching improves performance but should not be trusted as the final source of truth when confirming a purchase.

Based on the feedback I received, I would improve the architecture diagram and explain the flow of information between the application servers, database, payment provider, and background worker more clearly. I would also add more detail about handling failed payments, expired seat holds, and high traffic during popular concert sales. These improvements would make the design easier to understand and demonstrate how the system maintains correctness and reliability.

Next, I want to learn more about building REST APIs and implementing database transactions in practice. I would like to use Python with FastAPI and PostgreSQL to build a small working version of TicketHub. I also want to explore automated testing, load testing, and cloud deployment so I can understand how a system performs under real-world conditions.

This capstone has helped me understand that good system design involves more than writing code. It requires identifying problems, making informed trade-offs, and designing for reliability, performance, and fairness.
