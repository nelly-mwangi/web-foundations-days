# Library Books API Design

## Overview

The Library Books API allows users to retrieve, create, update, and delete books. It also supports searching for books written by a specific author.

Base URL: `/api`

## Endpoints

### 1. List All Books

- **Method:** GET
- **Path:** `/api/books`
- **Description:** Retrieves a list of all books in the library.
- **Success Status Code:** `200 OK`

### 2. Get One Book

- **Method:** GET
- **Path:** `/api/books/:id`
- **Description:** Retrieves details of a specific book using its ID.
- **Success Status Code:** `200 OK`

### 3. Create a Book

- **Method:** POST
- **Path:** `/api/books`
- **Description:** Adds a new book to the library.
- **Example Request Body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958
}
```
