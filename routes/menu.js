document.addEventListener("DOMContentLoaded", () => {
  const dropdown = document.querySelector(".dropdown a");
  const dropdownContent = document.querySelector(".dropdown-content");

  if (dropdown && dropdownContent) {
    dropdown.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default link behavior
      dropdownContent.style.display =
        dropdownContent.style.display === "block" ? "none" : "block";
    });
  }
});