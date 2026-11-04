// ==UserScript==
// @name         for new tms - final version
// @namespace    http://tampermonkey.net/
// @version      2026-11-04-33
// @description  Loop check with spinner wait and content check
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
  localStorage.setItem("checkResults", JSON.stringify({ locked: [], unavailable: [] }));

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
  const results = JSON.parse(localStorage.getItem("checkResults")) || { locked: [], unavailable: [] };
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
    localStorage.setItem("checkResults", JSON.stringify({ locked: [], unavailable: [] }));
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

    // 3. Чекаємо, поки модалка завантажиться (спінер зникне І з'явиться контент)
    waitForModalToLoad().then((modal) => {
      console.log("Модалка завантажена. Аналізуємо результат...");

      // 4. Тепер перевіряємо, що всередині (замок або No Results)
      const result = checkModalResult(modal);

      if (result.type === "unavailable") {
        console.log(`⚠️ ${currentFB} — не знайдено в системі (No Results).`);
        saveResult("unavailable", currentFB);
      }
      else if (result.type === "locked") {
        saveResult("locked", currentFB);
      }
      else if (result.type === "unlocked") {
        console.log(`🔵 ${currentFB} — unlocked (skipped).`);
      }
      else {
        console.warn(`Для ${currentFB} результат невідомий.`);
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

// ЧЕКАЄМО, ПОКИ МОДАЛКА ЗАВАНТАЖИТЬСЯ (СПІНЕР ЗНИКНЕ І З'ЯВИТЬСЯ КОНТЕНТ)
function waitForModalToLoad() {
  return new Promise((resolve) => {
    // 1. Чекаємо на появу модалки
    waitForElement("#tms-app-modal-container").then((modal) => {
      console.log("Модалка з'явилась. Чекаємо на завантаження...");

      const checkContentLoaded = () => {
        // Перевіряємо, чи зник спінер
        const spinner = modal.querySelector(".uxloadmask");
        const spinnerGone = !spinner;

        // Перевіряємо, чи з'явився контент:
        // або картка з вантажем (.mg-lock-container), або блок "No Results" (.global-search-no-results-wrapper)
        const hasCard = modal.querySelector(".mg-lock-container");
        const hasNoResults = modal.querySelector(".global-search-no-results-wrapper");

        if (spinnerGone && (hasCard || hasNoResults)) {
          resolve(modal);
          return true;
        }
        return false;
      };

      // Якщо все вже завантажено (швидкий інтернет) — одразу повертаємо
      if (checkContentLoaded()) return;

      // Інакше чекаємо на зміни в DOM
      const observer = new MutationObserver((mutations, obs) => {
        if (checkContentLoaded()) {
          obs.disconnect();
        }
      });

      observer.observe(modal, { childList: true, subtree: true });
    });
  });
}

// ПЕРЕВІРКА РЕЗУЛЬТАТУ В МОДАЛЦІ
function checkModalResult(modal) {
  // 1. Перевіряємо, чи є блок "No Results"
  const noResultsWrapper = modal.querySelector(".global-search-no-results-wrapper");
  if (noResultsWrapper) {
    return { type: "unavailable" };
  }

  // 2. Перевіряємо, чи є іконка замка
  const lockContainer = modal.querySelector(".mg-lock-container");
  if (lockContainer) {
    const span = lockContainer.querySelector("span");
    if (span && span.classList.contains("mg-lock-icon")) {
      return { type: "locked" };
    }
    if (span && span.classList.contains("mg-unlock-icon")) {
      return { type: "unlocked" };
    }
    const svg = lockContainer.querySelector("svg");
    if (svg && svg.classList.contains("mg-lock-icon")) {
      return { type: "locked" };
    }
    if (svg && svg.classList.contains("mg-unlock-icon")) {
      return { type: "unlocked" };
    }
  }
  return { type: "unknown" };
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
  const results = JSON.parse(localStorage.getItem("checkResults")) || { locked: [], unavailable: [] };
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
  resultBlock.style.maxHeight = "200px";
  resultBlock.style.overflowY = "auto";

  const title = document.createElement("strong");
  title.textContent = "Результати перевірки:";
  resultBlock.append(title);
  resultBlock.append(document.createElement("br"));

  if (results.locked.length > 0) {
    const lockedTitle = document.createElement("div");
    lockedTitle.innerHTML = "<b style='color: red;'>🔴 Locked:</b>";
    resultBlock.append(lockedTitle);
    results.locked.forEach(fb => {
      const span = document.createElement("div");
      span.textContent = fb;
      resultBlock.append(span);
    });
  }

  if (results.unavailable.length > 0) {
    const unavailableTitle = document.createElement("div");
    unavailableTitle.innerHTML = "<b style='color: gray;'>⚪ Unavailable (No Results):</b>";
    resultBlock.append(unavailableTitle);
    results.unavailable.forEach(fb => {
      const span = document.createElement("div");
      span.textContent = fb;
      resultBlock.append(span);
    });
  }

  if (results.locked.length === 0 && results.unavailable.length === 0) {
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
