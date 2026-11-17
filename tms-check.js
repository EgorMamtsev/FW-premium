// ==UserScript==
// @name         for new tms - smart EL attachment counter
// @namespace    http://tampermonkey.net/
// @version      2026-11-17-5
// @description  Loop check counting attachments only for EL (blue) delivered loads
// @author       You
// @match        https://landstar.mercurygate.net/MercuryGate/dashboard/wide/dashboardFrameless.jsp
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mercurygate.net
// @grant        none
// ==/UserScript==

"use strict";

//======== buttons ========
function createButtons() {
  if (document.querySelector(".check-status-wrapper")) return;

  const wrapper = document.createElement("div");
  wrapper.classList.add("check-status-wrapper");

  wrapper.style.position = "fixed";
  wrapper.style.bottom = "20px";
  wrapper.style.left = "20px";
  wrapper.style.zIndex = "99999";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "flex-start";
  wrapper.style.gap = "8px";
  wrapper.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
  wrapper.style.padding = "10px";
  wrapper.style.border = "1px solid #ccc";
  wrapper.style.borderRadius = "6px";
  wrapper.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";

  const inputRow = document.createElement("div");
  inputRow.style.display = "flex";
  inputRow.style.alignItems = "center";
  inputRow.style.gap = "8px";
  inputRow.append(createInput());
  inputRow.append(createInsertDataBtn());
  inputRow.append(createCheckBtn());
  inputRow.append(createClearBtn());

  wrapper.append(inputRow);
  document.body.append(wrapper);
}

function createInput() {
  const inputData = document.createElement("input");
  inputData.classList.add("inputData");
  inputData.type = "text";
  inputData.placeholder = "FB numbers: 123,456,789";
  inputData.style.padding = "4px 8px";
  inputData.style.fontSize = "14px";
  return inputData;
}

function createInsertDataBtn() {
  const insertDataBtn = document.createElement("button");
  insertDataBtn.type = "button";
  insertDataBtn.classList.add("insertDataBtn");
  insertDataBtn.textContent = "Insert Data";
  insertDataBtn.addEventListener("click", insertData);
  return insertDataBtn;
}

function createCheckBtn() {
  const checkBtn = document.createElement("button");
  checkBtn.type = "button";
  checkBtn.classList.add("checkBtn");
  checkBtn.textContent = "Check Completed";
  checkBtn.addEventListener("click", startChecking);
  return checkBtn;
}

function createClearBtn() {
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.classList.add("clearBtn");
  clearBtn.textContent = "Clear All";
  clearBtn.style.backgroundColor = "#ffcccc";
  clearBtn.addEventListener("click", () => {
    localStorage.removeItem("needToCheck");
    localStorage.removeItem("index");
    localStorage.removeItem("checkResults");

    const oldResult = document.querySelector(".locked-results-block");
    if (oldResult) oldResult.remove();

    console.log("Всі дані очищено.");
  });
  return clearBtn;
}
//================================

function insertData() {
  const input = document.querySelector(".inputData");
  const dataArray = input.value.split(",").map(Number);
  localStorage.setItem("needToCheck", JSON.stringify(dataArray));
  localStorage.removeItem("index");
  
  localStorage.setItem("checkResults", JSON.stringify({ 
    under_10: [], 
    from_10_to_12: [], 
    from_13_plus: []
  }));

  const oldResult = document.querySelector(".locked-results-block");
  if (oldResult) oldResult.remove();

  console.log("Saved to needToCheck:", dataArray);
}
//================================

//======== indexes & state =========
function getIndex() {
  return JSON.parse(localStorage.getItem("index")) || 0;
}

function increaseIndex() {
  const index = getIndex() + 1;
  localStorage.setItem("index", JSON.stringify(index));
}

function getCurrentFB() {
  const checkingFBs = JSON.parse(localStorage.getItem("needToCheck"));
  return checkingFBs ? checkingFBs[getIndex()] : undefined;
}

function saveResult(type, fb) {
  const results = JSON.parse(localStorage.getItem("checkResults")) || { 
    under_10: [], 
    from_10_to_12: [], 
    from_13_plus: []
  };
  
  if (!results[type].includes(fb)) {
    results[type].push(fb);
    localStorage.setItem("checkResults", JSON.stringify(results));
    console.log(`[${type.toUpperCase()}] ${fb} збережено.`);
  }
}
//================================

//========= LOOP PROCESS =========
function startChecking() {
  const checkingFBs = JSON.parse(localStorage.getItem("needToCheck"));
  if (!checkingFBs || checkingFBs.length === 0) {
    console.warn("needToCheck порожній — спочатку натисни Insert Data");
    return;
  }

  const oldResult = document.querySelector(".locked-results-block");
  if (oldResult) oldResult.remove();

  if (localStorage.getItem("index") === null) {
    localStorage.setItem("index", JSON.stringify(0));
  }

  if (localStorage.getItem("checkResults") === null) {
    localStorage.setItem("checkResults", JSON.stringify({ 
      under_10: [], 
      from_10_to_12: [], 
      from_13_plus: []
    }));
  }

  processNextFB();
}

function processNextFB() {
  const currentFB = getCurrentFB();

  if (currentFB === undefined) {
    console.log("=== Всі номери перевірено ===");
    localStorage.removeItem("index");
    showFinishMessage();
    return;
  }

  console.log(`=== Починаємо перевірку для: ${currentFB} (Індекс: ${getIndex()}) ===`);

  const input = document.getElementById("global-search-input");
  if (!input) {
    console.error("Не знайдено поле пошуку #global-search-input");
    return;
  }

  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const rect = input.getBoundingClientRect();
  const clickX = rect.left + rect.width / 2;
  const clickY = rect.top + rect.height / 2;

  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: clickX, clientY: clickY }));
  input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: clickX, clientY: clickY }));
  input.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: clickX, clientY: clickY }));
  input.focus();

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeInputValueSetter.call(input, currentFB);

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter" }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter" }));

  // 2. Чекаємо на кнопку пошуку і клікаємо
  waitForElement(".global-search-go-button").then((goBtn) => {
    const btnRect = goBtn.getBoundingClientRect();
    const btnX = btnRect.left + btnRect.width / 2;
    const btnY = btnRect.top + btnRect.height / 2;

    goBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: btnX, clientY: btnY }));
    goBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: btnX, clientY: btnY }));
    goBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: btnX, clientY: btnY }));

    // 3. Чекаємо, поки модалка завантажиться
    waitForModalToLoad().then((modal) => {
      console.log("Модалка завантажена. Аналізуємо результат...");

      // 4. Перевіряємо статус та кількість вкладень
      const result = checkModalResult(modal);

      if (result.type === "unavailable") {
        console.log(`⚠️ ${currentFB} — не знайдено в системі.`);
      }
      else if (result.type === "not_delivered") {
        console.log(`⚪ ${currentFB} — статус не Delivered. Пропускаємо.`);
      }
      else {
        // Розподіляємо за категоріями
        if (result.type === "under_10") {
          saveResult("under_10", currentFB);
          console.log(`🔴 ${currentFB} — Delivered, <10 вкладень (${result.count}). Збережено.`);
        }
        else if (result.type === "from_10_to_12") {
          saveResult("from_10_to_12", currentFB);
          console.log(`🟡 ${currentFB} — Delivered, 10-12 вкладень (${result.count}). Збережено.`);
        }
        else if (result.type === "from_13_plus") {
          saveResult("from_13_plus", currentFB);
          console.log(`🟢 ${currentFB} — Delivered, 13+ вкладень (${result.count}). Збережено.`);
        }
        else {
          console.log(`❓ ${currentFB} — невідомий результат.`);
        }
      }

      // 5. Закриваємо модалку
      closeModal(modal);

      // 6. Чекаємо 1.5 секунди і запускаємо наступний
      setTimeout(() => {
        increaseIndex();
        processNextFB();
      }, 1500);
    });
  });
}

// УНІВЕРСАЛЬНИЙ ОБСЕРВЕР
function waitForElement(selector) {
  return new Promise((resolve) => {
    const check = () => {
      const el = document.querySelector(selector);
      if (el && el.getBoundingClientRect().width > 0) {
        resolve(el);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver((mutations, obs) => {
      if (check()) {
        obs.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// ЧЕКАЄМО, ПОКИ МОДАЛКА ЗАВАНТАЖИТЬСЯ
function waitForModalToLoad() {
  return new Promise((resolve) => {
    waitForElement("#tms-app-modal-container").then((modal) => {
      console.log("Модалка з'явилась. Чекаємо на завантаження...");

      const checkContentLoaded = () => {
        const spinner = modal.querySelector(".uxloadmask");
        const spinnerGone = !spinner;

        const hasCard = modal.querySelector(".mg-lock-container");
        const hasNoResults = modal.querySelector(".global-search-no-results-wrapper");

        if (spinnerGone && (hasCard || hasNoResults)) {
          resolve(modal);
          return true;
        }
        return false;
      };

      if (checkContentLoaded()) return;

      const observer = new MutationObserver((mutations, obs) => {
        if (checkContentLoaded()) {
          obs.disconnect();
        }
      });

      observer.observe(modal, { childList: true, subtree: true });
    });
  });
}

// ПЕРЕВІРКА РЕЗУЛЬТАТУ (ШУКАЄМО САМЕ СИНІЙ БЛОК EL)
function checkModalResult(modal) {
  // 1. Перевіряємо, чи є блок "No Results"
  const noResultsWrapper = modal.querySelector(".global-search-no-results-wrapper");
  if (noResultsWrapper) {
    return { type: "unavailable" };
  }

  // 2. Перевіряємо, чи є статус "Delivered" хоч в одному блоці
  let isDelivered = false;
  const statusElements = modal.querySelectorAll(".status-component .sc-status");
  for (const el of statusElements) {
    if (el.textContent.trim() === "Delivered") {
      isDelivered = true;
      break;
    }
  }

  if (!isDelivered) {
    return { type: "not_delivered" };
  }

  // 3. Знаходимо САМЕ СИНІЙ БЛОК (EL)
  let targetBlock = null;
  const loadCards = modal.querySelectorAll(".mg-global-search-resultsMatch .loadheader-section");
  
  for (const card of loadCards) {
    // Перевіряємо, чи є в цьому блоці ідентифікатор EL
    const elIdElement = card.querySelector(".loadheader-identity a[id^='loadheader-identity-EL']");
    if (elIdElement) {
      targetBlock = card;
      break;
    }
  }

  if (!targetBlock && loadCards.length > 0) {
    // Fallback: беремо перший-ліпший блок, якщо EL не знайдено
    targetBlock = loadCards[0];
    console.log("⚠️ Не знайдено блок EL, беремо перший-ліпший.");
  }

  // 4. Шукаємо кількість вкладень САМЕ В ЦЬОМУ БЛОЦІ
  let attachmentCount = 0;
  
  if (targetBlock) {
    const attachmentsContainer = targetBlock.querySelector(".attachments");
    if (attachmentsContainer) {
      const badge = attachmentsContainer.querySelector(".badge-container");
      if (badge) {
        attachmentCount = parseInt(badge.textContent.trim(), 10) || 0;
      }
    }
  }

  console.log(`Знайдено Delivered. Кількість вкладень (синій блок EL): ${attachmentCount}`);

  // 5. Розподіляємо за категоріями
  if (attachmentCount < 10) {
    return { type: "under_10", count: attachmentCount };
  } else if (attachmentCount >= 10 && attachmentCount <= 12) {
    return { type: "from_10_to_12", count: attachmentCount };
  } else {
    return { type: "from_13_plus", count: attachmentCount };
  }
}

// ЗАКРИТТЯ МОДАЛКИ
function closeModal(modal) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));

  const closeBtnWrapper = modal.querySelector(".ux-close-button-wrapper");
  if (closeBtnWrapper) {
    closeBtnWrapper.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    closeBtnWrapper.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    closeBtnWrapper.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    closeBtnWrapper.click();
  }
}

// ФІНАЛЬНЕ ПОВІДОМЛЕННЯ ТА БЛОК РЕЗУЛЬТАТІВ
function showFinishMessage() {
  const results = JSON.parse(localStorage.getItem("checkResults")) || { 
    under_10: [], 
    from_10_to_12: [], 
    from_13_plus: []
  };
  console.log("=== Перевірка завершена ===");
  console.log("Результати:", results);

  const oldResult = document.querySelector(".locked-results-block");
  if (oldResult) oldResult.remove();

  const resultBlock = document.createElement("div");
  resultBlock.classList.add("locked-results-block");
  resultBlock.style.marginTop = "10px";
  resultBlock.style.padding = "10px";
  resultBlock.style.backgroundColor = "#f9f9f9";
  resultBlock.style.border = "1px solid #ddd";
  resultBlock.style.borderRadius = "4px";
  resultBlock.style.fontSize = "13px";
  resultBlock.style.width = "100%";
  resultBlock.style.boxSizing = "border-box";
  resultBlock.style.maxHeight = "400px";
  resultBlock.style.overflowY = "auto";

  const title = document.createElement("strong");
  title.textContent = "Результати перевірки (Delivered):";
  resultBlock.append(title);
  resultBlock.append(document.createElement("br"));

  // Категорія 1: < 10
  if (results.under_10.length > 0) {
    const title1 = document.createElement("div");
    title1.innerHTML = "<b style='color: red;'>🔴 До 9 вкладень:</b>";
    resultBlock.append(title1);
    results.under_10.forEach(fb => {
      const span = document.createElement("div");
      span.textContent = fb;
      resultBlock.append(span);
    });
    resultBlock.append(document.createElement("br"));
  }

  // Категорія 2: 10-12
  if (results.from_10_to_12.length > 0) {
    const title2 = document.createElement("div");
    title2.innerHTML = "<b style='color: orange;'>🟡 10-12 вкладень:</b>";
    resultBlock.append(title2);
    results.from_10_to_12.forEach(fb => {
      const span = document.createElement("div");
      span.textContent = fb;
      resultBlock.append(span);
    });
    resultBlock.append(document.createElement("br"));
  }

  // Категорія 3: 13+
  if (results.from_13_plus.length > 0) {
    const title3 = document.createElement("div");
    title3.innerHTML = "<b style='color: green;'>🟢 13+ вкладень:</b>";
    resultBlock.append(title3);
    results.from_13_plus.forEach(fb => {
      const span = document.createElement("div");
      span.textContent = fb;
      resultBlock.append(span);
    });
  }

  if (results.under_10.length === 0 && results.from_10_to_12.length === 0 && results.from_13_plus.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "Нічого не знайдено.";
    resultBlock.append(empty);
  }

  const wrapper = document.querySelector(".check-status-wrapper");
  if (wrapper) {
    wrapper.append(resultBlock);
  }
}
//================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createButtons);
} else {
  createButtons();
}
