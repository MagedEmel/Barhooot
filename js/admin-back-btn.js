// لو الأدمن دخل على حساب تاني، يظهرله زرار يرجعه
if (localStorage.getItem("clan_admin_mode") === "1") {
  const backBtn = document.createElement("button");
  backBtn.textContent = "↩ رجوع للأدمن";
  backBtn.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 9999;
    background: linear-gradient(135deg, #8a0303, #c81414);
    color: #fff; border: none; border-radius: 50px;
    padding: 10px 18px; font-size: 13px; font-weight: 700;
    cursor: pointer; box-shadow: 0 4px 18px rgba(200,20,20,.5);
    font-family: 'Cairo', sans-serif;
  `;
  backBtn.addEventListener("click", () => {
    localStorage.removeItem("clan_user");
    localStorage.removeItem("clan_admin_mode");
    sessionStorage.removeItem("clan_user");
    window.location.href = "index.html";
  });
  document.body.appendChild(backBtn);
}