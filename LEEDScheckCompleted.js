// ==UserScript==
// @name         Check Statuses
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Getting all statuses
// @author       Mr. George
// @match        https://leads.landstaronline.com/FreightBills/FreightBillsListView.aspx
// @match        https://leads.landstaronline.com/FreightBills/FreightBillsListView.aspx?filter=InProcess
// @icon         https://www.google.com/s2/favicons?sz=64&domain=landstaronline.com
// @grant        none
// ==/UserScript==

"use strict";

const statuses = ["COMPLETED", "READY TO PRINT", "VOID", "FINAL RATED"];

function findMainInputField() {
  return document.querySelector("span.RadInput_Office2007");
}

//======== buttons ========
function createButtons() {
  const checkBtnAddField = document.querySelector("div.data");
  checkBtnAddField.append(createCheckBtn());
  checkBtnAddField.append(createInsertDataBtn());
  checkBtnAddField.append(createInput());
}

function createCheckBtn() {
  const checkBtn = document.createElement("button");
  checkBtn.type = "button";

  checkBtn.classList.add("checkBtn");
  checkBtn.textContent = "Check Completed";
  checkBtn.addEventListener("click", startChecking);
  return checkBtn;
}

function createInsertDataBtn() {
  const insertDataBtn = document.createElement("button");
  insertDataBtn.type = "button";
  insertDataBtn.classList.add("insertDataBtn");
  insertDataBtn.textContent = "Insert Data";
  insertDataBtn.addEventListener("click", insertData);
  return insertDataBtn;
}

function createInput() {
  const inputData = document.createElement("input");
  inputData.classList.add("inputData");
  inputData.type = "text";
  return inputData;
}
//================================

// функція зберігає масив вантажей в локальне сховище needToCheck []
function insertData() {
  const input = document.querySelector(".inputData");
  const dataArray = input.value.split(",").map(Number);
  return localStorage.setItem("needToCheck", JSON.stringify(dataArray));
}

//======== indexes =========
// функція перевіряє наявність індексу і якщо його не має створює його
function createIndex() {
  let index = localStorage.getItem("index");
  index = JSON.parse(index);
  if (index == null) {
    index = 0;
    index = localStorage.setItem("index", JSON.stringify(index));
  }
  return index;
}

function clearIndex() {
  localStorage.removeItem("index");
}

function getIndex() {
  return JSON.parse(localStorage.getItem("index"));
}

function increaseIndex() {
  let index = getIndex() + 1;
  return localStorage.setItem("index", JSON.stringify(index));
}

function checkIndexToKeepChecking() {
  let checkingFBs = localStorage.getItem("needToCheck"); // массів вантажів
  checkingFBs = JSON.parse(checkingFBs);

  if (getIndex() !== null && getIndex() < checkingFBs.length) {
    startChecking();
  }

  if (getIndex() >= checkingFBs.length) {
    showFinishMessage();

    return;
  }
}
//===========================================

//========= checking proses =========
// функція розпочинає перебор масиву needToCheck
function startChecking() {
  let checkingPromise = new Promise((resolve) => {
    let leedsInt = setInterval(() => {
      if (findMainInputField() !== null) {
        clearInterval(leedsInt);
        resolve();
      }
    }, 100);
  });
  checkingPromise.then(() => {
    if (getIndex() === null) {
      createIndex();

      let currentFB = getCurrentFB(getIndex());
      inserValue(currentFB);
      clickFindBtn();
      return;
    }

    let completed = localStorage.getItem("completed");
    if (completed === null) {
      completed = {};
      localStorage.setItem("completed", JSON.stringify(completed));
    }

    checkStatus();

    let currentFB = getCurrentFB(getIndex());
    if (currentFB === undefined) {
      showFinishMessage();
      clearIndex();
      return;
    }

    inserValue(currentFB);
    clickFindBtn();
  });
}

function inserValue(value) {
  const findInputField = document.querySelector("input.riTextBox");
  findInputField.value = value;
  return;
}

function clickFindBtn() {
  let findBtn = document.getElementById(
    "ctl00_ctl00_SiteMasterContent_PageContent_btnFBNum",
  );
  findBtn.click();
}

function getCurrentFB(index) {
  let checkingFBs = localStorage.getItem("needToCheck"); // массів вантажів
  checkingFBs = JSON.parse(checkingFBs);
  return checkingFBs[index];
}

function checkStatus() {
  let findStatus = document.getElementById(
    "ctl00_ctl00_SiteMasterContent_PageContent_dgFreightBills_ctl00__0",
  );
  if (findStatus == null) {
    saveLoad("UNAVAILIVLE");

    increaseIndex();
    return;
  }
  const status = findStatus.children[17].textContent;
  if (statuses.includes(status)) {
    saveLoad(status);
  } else {
    increaseIndex();
  }
  return;
}

function saveLoad(status) {
  let completed = JSON.parse(localStorage.getItem("completed"));

  if (!Array.isArray(completed[status])) {
    completed[status] = [];
  }

  completed[status].push(getCurrentFB(getIndex()));

  localStorage.setItem("completed", JSON.stringify(completed));
  increaseIndex();
}

function showFinishMessage() {
  inserValue("Checking Completed");
  createResultBlock();
  return;
}
//======================================================

function createResultBlock() {
  const table = document.querySelector("div.RadGrid_Office2007");
  const resultBlock = document.createElement("div");
  resultBlock.classList.add("result-block");
  resultBlock.style.textAlign = "left";
  table.append(resultBlock);

  const completed = JSON.parse(localStorage.getItem("completed"));

  for (const status in completed) {
    const span = document.createElement("span");

    // Розділяємо масив через ', ' щоб після коми був пробіл
    span.textContent = `${status}: ${completed[status].join(", ")}`;

    span.style.display = "block";
    resultBlock.appendChild(span);
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Jobs Done";
  clearBtn.addEventListener("click", () => {
    resultBlock.remove();
    localStorage.removeItem("completed");
    localStorage.removeItem("needToCheck");
    localStorage.removeItem("index");
  });
  resultBlock.append(clearBtn);
}

// проміс перевіряє чи завантажилась сторінка
let leedsLoad = new Promise((resolve) => {
  let leedsInt = setInterval(() => {
    if (findMainInputField() != null) {
      clearInterval(leedsInt);

      resolve();
    }
  }, 100);
});
leedsLoad.then(() => {
  createButtons();
  checkIndexToKeepChecking();
});
