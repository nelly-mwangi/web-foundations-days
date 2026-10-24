const loadUsersButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

async function loadUsers() {
  loadUsersButton.disabled = true;
  statusMessage.textContent = "Loading users...";
  usersList.replaceChildren();

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    users = await response.json();

    renderUsers(users);

    statusMessage.textContent = `Successfully loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    renderUsers([]);

    statusMessage.textContent =
      "Failed to load users. Please check your connection and try again.";

    console.error("Error loading users:", error);
  } finally {
    loadUsersButton.disabled = false;
  }
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    return;
  }

  list.forEach(function (user) {
    const listItem = document.createElement("li");

    const name = document.createElement("h3");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    listItem.appendChild(name);
    listItem.appendChild(email);
    listItem.appendChild(city);
    listItem.appendChild(company);

    usersList.appendChild(listItem);
  });
}

loadUsersButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", function () {
  const searchTerm = filterInput.value.trim().toLowerCase();

  const filteredUsers = users.filter(function (user) {
    return user.name.toLowerCase().includes(searchTerm);
  });

  renderUsers(filteredUsers);

  if (users.length > 0 && filteredUsers.length === 0) {
    statusMessage.textContent = "No users match your filter.";
  } else if (users.length > 0) {
    statusMessage.textContent = `Showing ${filteredUsers.length} of ${users.length} users.`;
  }
});
