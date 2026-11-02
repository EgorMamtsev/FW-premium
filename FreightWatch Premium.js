// ==UserScript==
// @name         Freight Watch Premium (Fixed)
// @namespace    http://tampermonkey.net/
// @version      2026-11-02.10
// @description  You will see - adapted to new ERP DOM
// @author       GM
// @match        https://erp.gologity.com/freight-watch/dispatch
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  //#region операційні змінні
  const FUTURES = {
    countUpdates: true,
    markUpdates: true,
    comments: true,
    updatesCounter: true,
    loadsCounter: true,
    hideSideBar: true,
    filters: false,
    generateSMS: true,
  };

  const dispName = "George";

  const filterParams = {
    byStatus: [],
    byClass: [],
    byDate: [],
  };

  // ====== ДОПОМІЖНІ ФУНКЦІЇ ======

  function getTableRows() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll("tr.ng-star-inserted"));
  }

  function getFbFromRow(row) {
    try {
      const td = row.children[1];
      if (!td) return null;
      const text = td.textContent.trim();
      const match = text.match(/(\d+)/);
      return match ? Number(match[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function getStatusFromRow(row) {
    try {
      const statusTd = row.querySelector("td.status");
      if (!statusTd) return "";
      const span = statusTd.querySelector("span");
      return span ? span.textContent.trim() : statusTd.textContent.trim();
    } catch (e) {
      return "";
    }
  }

  function createElem(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.classList.add(className);
    if (textContent) el.textContent = textContent;
    return el;
  }

  function createCheckBox(tag, className, type, filterParametr) {
    const el = document.createElement(tag);
    if (className) el.classList.add(className);
    if (type) el.type = type;
    if (filterParametr) {
      el.addEventListener("change", () => {
        addFilterParams(filterParametr[0], filterParametr[1], el.checked);
      });
    }
    return el;
  }

  //#endregion

  //#region getFunctions

  function getTbody() {
    return document.querySelector("tbody");
  }

  function getSaveBtn() {
    const allButtons = Array.from(document.querySelectorAll("button"));
    const textSaveBtn = allButtons.find(b => b.textContent.trim() === "Save");
    if (textSaveBtn) return textSaveBtn;

    const primaryBtn = document.querySelector("button.btn-primary");
    if (primaryBtn) return primaryBtn;

    const icons = Array.from(document.querySelectorAll("mat-icon"));
    const saveMatIcon = icons.find(i => i.textContent.trim() === "save");
    if (saveMatIcon) return saveMatIcon.closest("button");

    return document.querySelector("button.lgt-button-white") || document.querySelector("button.m-l-4");
  }

  function getEditBtn() {
    try {
      const icons = Array.from(document.querySelectorAll("mat-icon"));
      const editMatIcon = icons.find(i => i.textContent.trim() === "edit");
      if (editMatIcon) {
        const btn = editMatIcon.closest("button");
        if (btn) return btn;
      }

      const stopsWrapper = document.querySelector("div.stops-wrapper");
      if (!stopsWrapper) return null;
      return stopsWrapper.querySelector("button.lgt-button-white") || stopsWrapper.querySelector("button");
    } catch (error) {
      return null;
    }
  }

  function getComentField() {
    try {
      let textarea = document.querySelector("lgt-post-comment textarea.cdk-textarea-autosize");
      if (textarea) return textarea;
      const allTextareas = document.querySelectorAll("textarea.cdk-textarea-autosize");
      for (const ta of allTextareas) {
        const parent = ta.closest("lgt-form-field-textarea");
        if (parent && parent.getAttribute("formcontrolname") === "dispatchNotes") continue;
        return ta;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function getPostComentBtn() {
    try {
      const formActions = document.querySelector("lgt-form-actions.fit");
      if (formActions) return formActions.querySelector("button.lgt-button-primary");
      const commentField = getComentField();
      if (commentField) {
          const container = commentField.closest('.post-comment');
          if (container) return container.querySelector('button');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function getTodayDate() {
    const todayCST = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return todayCST;
  }

  function getSMSbntContainer() {
    const saveLgtBtn = document.querySelector("lgt-button.m-l-4");
    if (saveLgtBtn) return saveLgtBtn.closest(".row-item");
    return document.querySelector("div.row-item.d-flex.m-b-2") || null;
  }

  function getLoadStatus() {
    try {
      const statusEl = document.querySelector("span.mat-mdc-select-min-line");
      if (!statusEl) return "";
      return statusEl.textContent.trim();
    } catch (e) {
      return "";
    }
  }

  //#endregion

  //#region Mark and Count updates

  const StorageQueue = (() => {
    const queue = [];
    let isProcessing = false;
    const process = async () => {
      if (isProcessing || queue.length === 0) return;
      isProcessing = true;
      while (queue.length > 0) {
        const { key, value, resolve } = queue.shift();
        try {
          localStorage.setItem(key, value);
          console.log(`💾 [StorageQueue] Дані збережено в ${key}`);
          resolve(true);
        } catch (error) {
          console.error(`❌ [StorageQueue] Помилка збереження в ${key}`, error);
          resolve(false);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      isProcessing = false;
    };

    return {
      enqueue: (key, value) => new Promise((resolve) => {
        queue.push({ key, value, resolve });
        process();
      }),
      read: (key, defaultValue) => {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
          return defaultValue;
        }
      },
    };
  })();

  function initUpdated() {
    return StorageQueue.read("updated", { updates: 0, loads: 0, updated: [] });
  }

  let updatedState = initUpdated();

  function restoreUpdatedRows(state) {
    if (!FUTURES.markUpdates) return;
    const tbody = getTbody();
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    rows.forEach((row) => {
      const fb = getFbFromRow(row);
      if (fb === null) return;
      const fbCell = row.children[1];
      if (!fbCell) return;

      const textElement = fbCell.querySelector("p, span") || fbCell;

      if (state.updated.includes(fb) && !textElement.classList.contains("updated")) {
        textElement.classList.add("updated");
      }
    });
  }

  function removerMissingLoads() {
    const tbody = getTbody();
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    const fbOnPage = rows.map((row) => getFbFromRow(row)).filter((fb) => fb !== null);
    updatedState = initUpdated();
    const before = updatedState.updated.length;
    updatedState.updated = updatedState.updated.filter((fb) => fbOnPage.includes(Number(fb)));
    if (before !== updatedState.updated.length) {
      StorageQueue.enqueue("updated", JSON.stringify(updatedState));
    }
  }

  function countTimes(range) {
    const times = [];
    for (let i = 0; i < range.length; i += 1) {
      if (range[i].value && range[i].value.trim() !== "") times.push(range[i].value);
    }
    return times;
  }
  //#endregion

  //#region Comments
  function initComments() {
    return StorageQueue.read("comments", []);
  }

  let commentsState = initComments();

  function saveComment(data) {
    if (!FUTURES.comments || !data || typeof data.fb === "undefined" || data.fb === null) return false;
    try {
      commentsState = initComments();
      if (!Array.isArray(commentsState)) commentsState = [];
      const index = commentsState.findIndex((c) => Number(c.fb) === Number(data.fb));
      if (index !== -1) commentsState[index] = data;
      else commentsState.push(data);
      StorageQueue.enqueue("comments", JSON.stringify(commentsState));
      return true;
    } catch (error) { return false; }
  }

  function generateComment(fb, status, commentBox) {
    if (!FUTURES.comments || !fb) return;
    try {
      let willBeSaved = { fb: fb, status: status, comment: "no comments", timestamp: new Date().toISOString() };
      if (commentBox && commentBox.children && commentBox.children.length > 0) {
        try {
          willBeSaved = {
            ...willBeSaved,
            comment: findComment() || "no comments yet",
            commentTime: findCommentTime ? findCommentTime() : null,
            timeZone: findTimeZone ? findTimeZone() : null,
            inTime: findInTime ? findInTime() : null,
          };
        } catch (error) {}
      }
      saveComment(willBeSaved);
    } catch (error) {}
  }

  function findComment() {
    try {
      let commentsBox = document.querySelector("div.comments__regular");
      if (!commentsBox || commentsBox.children.length === 0) return "no comments yet";
      const commentBody = commentsBox.querySelector(".body1");
      if (!commentBody) return "no comments yet";
      let comment = commentBody.textContent;
      if (comment.length > 50) comment = `${comment.slice(0, 50)}...`;
      return comment;
    } catch (error) { return "no comments yet"; }
  }

  function findCommentTime() {
    try {
      const commentTimeBox = document.querySelector("div.comments__regular");
      if (!commentTimeBox) return null;
      const commentContainer = commentTimeBox.querySelector("div.comment-container");
      if (!commentContainer) return null;
      const dateSpan = commentContainer.querySelector("span.date");
      if (!dateSpan) return null;
      return dateSpan.textContent.slice(-8);
    } catch (error) { return null; }
  }

  function findInTime() {
    try {
      let findStops = document.querySelectorAll("div.stop-item");
      if (!findStops || findStops.length === 0) return null;
      let pickUpDateItem = findStops[0].querySelectorAll("p.date");
      let delDateItem = findStops[findStops.length - 1].querySelectorAll("p.date");
      if (!pickUpDateItem || !delDateItem) return null;
      if (pickUpDateItem[2] && pickUpDateItem[2].textContent == "") return pickUpDateItem[1].textContent.slice(-5);
      else if (delDateItem[1]) return delDateItem[1].textContent.slice(-5);
      return null;
    } catch (error) { return null; }
  }

  function findTimeZone() {
    try {
      let findStops = document.querySelectorAll("div.stop-item");
      let pickUpDateItem = findStops[0]?.querySelectorAll("p.date");
      let findTimeZoneBox = document.querySelectorAll("p.m-b-1");
      if (!pickUpDateItem || !findStops || !findTimeZoneBox) return null;
      if (pickUpDateItem[2] && pickUpDateItem[2].textContent == "") return findTimeZoneBox[0]?.textContent.slice(-3) || null;
      else if (findTimeZoneBox[1]) return findTimeZoneBox[1].textContent.slice(-3);
      return null;
    } catch (error) { return null; }
  }

  function restoreComments() {
    if (!FUTURES.comments) return;
    setInterval(() => {
      commentsState = initComments();
      const tbody = getTbody();
      if (!tbody) return;
      const rows = Array.from(tbody.children);
      rows.forEach((row) => {
        const fb = getFbFromRow(row);
        if (fb === null) return;
        const commentData = commentsState.find((c) => Number(c.fb) === fb);
        if (!commentData) return;

        const statusTd = row.querySelector("td.status");
        if (statusTd) {
          const extra = [commentData.inTime, commentData.timeZone].filter(Boolean).join(" ");
          if (extra) {
            let extraSpan = statusTd.querySelector(".script-extra-status");
            if (!extraSpan) {
              extraSpan = document.createElement("span");
              extraSpan.className = "script-extra-status";
              extraSpan.style.fontSize = "10px";
              extraSpan.style.marginLeft = "4px";
              extraSpan.style.color = "#666";
              (statusTd.querySelector("div") || statusTd).appendChild(extraSpan);
            }
            extraSpan.textContent = extra;
          }
        }

        let commentCell = null;
        if (statusTd) {
          let next = statusTd.nextElementSibling;
          while (next && (next.textContent.trim() === "" || next.innerHTML.includes("&nbsp;"))) {
            if (next.textContent.trim() === "" || next.innerHTML.includes("&nbsp;")) {
              commentCell = next;
              break;
            }
            next = next.nextElementSibling;
          }
        }
        if (commentCell) {
          commentCell.textContent = `${commentData.commentTime || ""} ${commentData.comment || ""}`.trim();
        }
      });
    }, 500);
  }
  restoreComments();

  function cleanupComments() {
    commentsState = initComments();
    const tbody = getTbody();
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    const orangeFBs = rows.filter((r) => r.classList.contains("orange")).map((r) => getFbFromRow(r)).filter((fb) => fb !== null);
    commentsState = commentsState.filter((c) => orangeFBs.includes(Number(c.fb)));
    StorageQueue.enqueue("comments", JSON.stringify(commentsState));
  }
  //#endregion

  //#region LoadsCounter
  const counters = {};

  function createLoadsCounter() {
    if (!FUTURES.loadsCounter) return;
    const container = document.querySelector(".m-b-2");
    const dispatchDeliveredBnts = document.querySelector(".toggle-buttons-wrapper");
    if (!container) return;
    const loadsCounter = document.createElement("div");
    loadsCounter.classList.add("loads-counter");
    container.insertBefore(loadsCounter, dispatchDeliveredBnts);

    counters.whiteLoads = createCounterItem("need-to-check", "Need to check");
    counters.pinkLoads = createCounterItem("eta", "ETA");
    counters.yellowLoads = createCounterItem("on-site", "On site");
    counters.greenLoads = createCounterItem("in-transit", "In transit");
    counters.noAnswerLoads = createCounterItem("no-answer", "N/A");
    counters.totatlLoads = createCounterItem("total", "Total");

    loadsCounter.append(
      counters.whiteLoads.element, counters.pinkLoads.element, counters.yellowLoads.element,
      counters.greenLoads.element, counters.noAnswerLoads.element, counters.totatlLoads.element
    );
  }

  function createCounterItem(mod, itemLabel) {
    const item = document.createElement("div");
    item.classList.add("loads-counter__item", `loads-counter__item--${mod}`);
    const numberOfLoads = document.createElement("div");
    numberOfLoads.classList.add("loads-counter__count");
    const label = document.createElement("div");
    label.classList.add("loads-counter__label");
    label.textContent = itemLabel;
    item.append(numberOfLoads, label);
    return { element: item, numberOfElem: numberOfLoads };
  }

  function countPink() { counters.pinkLoads.numberOfElem.textContent = getTableRows().filter((r) => r.classList.contains("pink")).length; }
  function countYellow() { counters.yellowLoads.numberOfElem.textContent = getTableRows().filter((r) => r.classList.contains("orange")).length; }
  function countGreen() { counters.greenLoads.numberOfElem.textContent = getTableRows().filter((r) => r.classList.contains("green")).length; }
  function countNAloads() { counters.noAnswerLoads.numberOfElem.textContent = getTableRows().filter((r) => r.classList.contains("red")).length; }
  function countTotal() { counters.totatlLoads.numberOfElem.textContent = getTableRows().length; }
  function countWhiteLoads() {
    const all = getTableRows();
    const colored = all.filter((r) => r.classList.contains("pink") || r.classList.contains("orange") || r.classList.contains("green") || r.classList.contains("red")).length;
    counters.whiteLoads.numberOfElem.textContent = all.length - colored;
  }

  function startCount() {
    if (!FUTURES.loadsCounter) return;
    countWhiteLoads(); countPink(); countYellow(); countGreen(); countNAloads(); countTotal();
  }
  //#endregion

  //#region UpdatesCounter
  function createUpdatesCounter() {
    if (!FUTURES.updatesCounter) return;
    const elemBeforeCounter = document.querySelector(".headline5");
    if (!elemBeforeCounter) return;

    const counterContainer = createElem("div", "counterContainer");
    elemBeforeCounter.append(counterContainer);

    const updateCounter = createElem("div", "updateCounter");
    const updateLabel = createElem("div", "updateLabel", "Updates");
    const numberOfUpdates = createElem("div", "updateNumber");
    updateCounter.append(updateLabel, numberOfUpdates);
    counterContainer.append(updateCounter);

    const loadsCounter = createElem("div", "loadsCounter");
    const loadsLabel = createElem("div", "loadsLabel", "Loads");
    const numberOfLoads = createElem("div", "updateNumber");
    loadsCounter.append(loadsLabel, numberOfLoads);
    counterContainer.append(loadsCounter);

    const clearBtn = createElem("button", "clearBtn", "Clear");
    counterContainer.append(clearBtn);
    clearBtn.addEventListener("click", function () {
      updatedState.updates = 0;
      updatedState.loads = 0;
      StorageQueue.enqueue("updated", JSON.stringify(updatedState));
      showStats();
    });

    numberOfUpdates.textContent = updatedState.updates;
    numberOfLoads.textContent = updatedState.loads;
  }

  function showStats() {
    if (!FUTURES.updatesCounter) return;
    const u = document.querySelector(".updateCounter .updateNumber");
    const l = document.querySelector(".loadsCounter .updateNumber");
    if (u) u.textContent = updatedState.updates;
    if (l) l.textContent = updatedState.loads;
  }
  //#endregion

  //#region Hide SideBar
  function hideSideBar() {
    if (!FUTURES.hideSideBar) return;
    const sideBtn = document.querySelector(".side-menu__toggle");
    if (sideBtn) sideBtn.click();
  }
  //#endregion

  //#region Filters
  function createFilters() {
    if (!FUTURES.filters) return;
    const elemBefore = document.querySelector(".headline5");
    if (!elemBefore) return;

    const filterCountainer = createElem("div", "filter-container");
    elemBefore.append(filterCountainer);
    const filterByStatus = createElem("div", "filter-by-status__wrapper");
    filterCountainer.append(filterByStatus);

    const needToCheckWrapper = createElem("div", "need-to-check__wrapper");
    const etaToPickWrapper = createElem("div", "eta-to-pick__wrapper");
    const etaToDeliveryWrapper = createElem("div", "eta-to-delivery__wrapper");
    const inTransitWrapper = createElem("div", "in-transit__wrapper");
    const atPickWrapper = createElem("div", "at-pick__wrapper");
    const atDeliveryWrapper = createElem("div", "at-del__wrapper");
    const noAnswerWrapper = createElem("div", "no-answer__wrapper");
    const todayDateWrapper = createElem("div", "today-date__wrapper");

    const clearFilters = createElem("button", "clear-filters", "Default");
    clearFilters.addEventListener("click", () => {
      Object.keys(filterParams).forEach((k) => (filterParams[k] = []));
      document.querySelectorAll(".filter-container input[type='checkbox']").forEach((cb) => (cb.checked = false));
      applyFilters(filterParams);
    });
    filterCountainer.append(clearFilters);

    filterByStatus.append(needToCheckWrapper, inTransitWrapper, etaToPickWrapper, etaToDeliveryWrapper, atPickWrapper, atDeliveryWrapper, noAnswerWrapper, todayDateWrapper);

    needToCheckWrapper.append(createElem("span", "need-to-check__label", "Need to check"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "Need to check"]));
    etaToPickWrapper.append(createElem("span", "eta-to-pick__label", "ETA to pickup"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "ETA Pickup"]));
    etaToDeliveryWrapper.append(createElem("span", "eta-to-delivery__label", "ETA to delivery"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "ETA Delivery"]));
    inTransitWrapper.append(createElem("span", "in-transit__label", "In transit"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "In Transit/Loaded"]));
    atPickWrapper.append(createElem("span", "at-pick__label", "At pickup"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "At Pickup"]));
    atDeliveryWrapper.append(createElem("span", "at-delivery__label", "At delivery"), createCheckBox("input", "filter__input", "checkbox", ["byStatus", "At Delive"]));
    noAnswerWrapper.append(createElem("span", "no-answer__label", "N/A"), createCheckBox("input", "filter__input", "checkbox", ["byClass", "red"]));
    todayDateWrapper.append(createElem("span", "today-date__label", "Today"), createCheckBox("input", "today-date__input", "checkbox", ["byDate", getTodayDate()]));
  }

  function applyFilters(params) {
    if (!FUTURES.filters) return;
    const rows = getTableRows();
    rows.forEach((tr) => {
      let show = true;
      if (params.byStatus.length > 0) {
        let statusText = getStatusFromRow(tr);
        if (statusText.startsWith("At Pickup")) statusText = statusText.slice(0, 9);
        else if (statusText.startsWith("At Delivery")) statusText = statusText.slice(0, 9);
        if (!params.byStatus.includes(statusText)) show = false;
      }
      if (show && params.byClass.length > 0) {
        const rowClasses = Array.from(tr.classList);
        if (!params.byClass.some((cls) => rowClasses.includes(cls))) show = false;
      }
      if (params.byDate.length > 0) {
        const dateCells = Array.from(tr.children).filter((td) => /^\d{2}\/\d{2}/.test(td.textContent.trim()));
        const dates = dateCells.map((td) => td.textContent.trim().slice(0, 5));
        if (!params.byDate.some((d) => dates.includes(d))) show = false;
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function addFilterParams(filterType, query, checked) {
    if (!FUTURES.filters) return;
    const arr = filterParams[filterType];
    if (checked) { if (!arr.includes(query)) arr.push(query); }
    else { const index = arr.indexOf(query); if (index > -1) arr.splice(index, 1); }
    applyFilters(filterParams);
  }
  //#endregion

  //#region Generate SMS
  function createGenerateTxtBtn(fbNum) {
    if (!FUTURES.generateSMS || !fbNum) return;
    if (document.querySelector("button.generate-txt-btn")) return;

    const btnContainer = getSMSbntContainer();
    if (!btnContainer) return;

    const generateTxtBnt = createElem("button", "generate-txt-btn", "SMS");
    generateTxtBnt.style.marginLeft = "8px";
    generateTxtBnt.style.padding = "4px 8px";
    generateTxtBnt.style.cursor = "pointer";
    generateTxtBnt.style.borderRadius = "4px";
    generateTxtBnt.style.border = "1px solid #ccc";
    generateTxtBnt.style.backgroundColor = "#f0f0f0";

    btnContainer.append(generateTxtBnt);

    generateTxtBnt.addEventListener("click", () => {
      generateTxtMessage(dispName, fbNum);
    });
    console.log("✅ Кнопка SMS успішно створена");
  }

  function generateTxtMessage(name, fbNum) {
    const cities = getStops();
    if (!cities || cities.length < 2) return;
    const status = getLoadStatus();
    const messageFirstPart = `Hello , this is ${name} with Landstar Dispatch.\nRegarding load ${cities[0]} -> ${cities[1]} FB# ${fbNum} — `;
    let messageSecondPart = "";

    switch (status) {
      case "Need to check": messageSecondPart = `at what time will you be at the pick up in ${cities[0]} ?`; break;
      case "ETA Pickup": messageSecondPart = `have you arrived at the pick up in ${cities[0]} ?`; break;
      case "ETA Delivery": messageSecondPart = `have you arrived at the delivery in ${cities[1]} ?`; break;
      case "At Pickup": messageSecondPart = `have you got loaded in ${cities[0]} ?`; break;
      case "At Delivery": messageSecondPart = `have you got empty in ${cities[1]} ?`; break;
      case "In Transit/Loaded": messageSecondPart = `at what time will you be at the delivery in ${cities[1]} ?`; break;
      default: messageSecondPart = ``;
    }

    const field = getComentField();
    if (field) {
      field.value = messageFirstPart + messageSecondPart;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function getStops() {
    const stops = document.querySelectorAll(".stop-destination");
    if (stops.length > 0) {
      let firstCity, lastCity;
      const firstCityParts = stops[0].textContent.split(",");
      if (firstCityParts.length > 2) firstCity = firstCityParts[0].trim() + ", " + firstCityParts[2].trim();
      else firstCity = firstCityParts[0].trim() + ", " + firstCityParts[1].trim();

      const lastCityParts = stops[stops.length - 1].textContent.split(",");
      if (lastCityParts.length > 2) lastCity = lastCityParts[0].trim() + ", " + lastCityParts[2].trim();
      else lastCity = lastCityParts[0].trim() + ", " + lastCityParts[1].trim();

      return [firstCity, lastCity];
    }
    return null;
  }
  //#endregion

  //#region Observers
  const pageLoadingObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 30) {
      pageLoadingObserver.disconnect();

      createUpdatesCounter();
      createFilters();
      hideSideBar();
      removerMissingLoads();
      cleanupComments();
      createLoadsCounter();

      const loadsCounterObserver = new MutationObserver(() => startCount());
      loadsCounterObserver.observe(getTbody(), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  });
  pageLoadingObserver.observe(document.body, { childList: true, subtree: true });

  const highlightObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 0) restoreUpdatedRows(initUpdated());
  });
  highlightObserver.observe(document.body, { childList: true, subtree: true });
  //#endregion

  // Обробка кліку на рядок
  document.body.addEventListener("click", (e) => {
    const row = e.target.closest("tr.ng-star-inserted");
    if (!row) return;

    console.log("🖱️ [КЛІК] Клік по рядку виявлено. Чекаємо на модалку...");

    const modalObserver = new MutationObserver((mutations, obs) => {
      const stopsWrapper = document.querySelector("div.stops-wrapper");
      const statusEl = document.querySelector("span.mat-mdc-select-min-line");
      const fbEl = document.querySelector(".m-r-1 a");
      const commentWrapper = document.querySelector("div.dispatch-comments")?.querySelector("div.comments__regular");
      const editBtn = getEditBtn(); // Отримуємо саму кнопку
      const smsBtnContainer = getSMSbntContainer();
      const commentField = getComentField();

      if (!stopsWrapper || !statusEl || !fbEl || !commentWrapper || !editBtn || !smsBtnContainer || !commentField) {
        return;
      }

      if (modalObserver._processed) return;

      const fbMatch = fbEl.textContent.match(/(\d+)/);
      const fb = fbMatch ? Number(fbMatch[1]) : null;

      console.log("✅ [МОДАЛКА] Елементи знайдено!");
      console.log(`👉 FB: ${fb}`);

      if (!fb) {
        console.warn("⚠️ FB не знайдено, чекаємо...");
        return;
      }

      modalObserver._processed = true;
      const status = getLoadStatus();
      console.log(`👉 Status: ${status}`);

      createGenerateTxtBtn(fb);

      if (status === "At Pickup" || status === "At Delivery") {
        generateComment(fb, status, commentWrapper);

        commentField.addEventListener("click", () => {
          const postBtn = getPostComentBtn();
          if (!postBtn) {
            console.warn("⚠️ Кнопка Post Comment не знайдена");
            return;
          }

          const handlePostClick = () => {
            try {
              const date = new Date();
              saveComment({
                fb: fb,
                status: status,
                comment: commentField.value,
                commentTime: `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`,
                timeZone: findTimeZone(),
                inTime: findInTime(),
              });
              console.log("✅ Коментар збережено");
            } catch (error) {
              console.error("❌ Помилка збереження коментаря:", error);
            }
          };

          if (postBtn._handlePostClick) postBtn.removeEventListener("click", postBtn._handlePostClick);
          postBtn._handlePostClick = handlePostClick;
          postBtn.addEventListener("click", handlePostClick);
        }, { once: true });
      }

      // --- ВИПРАВЛЕННЯ ДЛЯ КНОПКИ EDIT ---
      if (editBtn) {
        console.log("👉 Знайдено кнопку Edit (олівець)");

        // Знаходимо батьківський блок, який містить цю кнопку (зазвичай це .middleline або .d-flex)
        // і вішаємо обробник на нього. Це дозволить клікати навіть на відступи навколо іконки.
        const editContainer = editBtn.closest('.d-flex') || editBtn.parentElement;

        const handleEditClick = (event) => {
          // Перевіряємо, чи клік був саме по кнопці або всередині неї
          if (!editBtn.contains(event.target)) return;

          console.log("🖱️ [EDIT] Натиснуто кнопку редагування, чекаємо на форму...");

          const timesObserver = new MutationObserver(() => {
            const timesWrapper = document.querySelector("div.m-y-5");
            if (!timesWrapper) return;

            const timeInputs = timesWrapper.querySelectorAll("input.mat-mdc-input-element");
            if (timeInputs.length === 0) return;

            console.log(`✅ [EDIT] Знайдено ${timeInputs.length} інпутів для часу`);

            const initialTimesCount = countTimes(timeInputs).length;
            const saveBtn = getSaveBtn();

            if (!saveBtn) {
              console.warn("❌ Кнопка Save (збереження) не знайдена!");
              return;
            }

            console.log("✅ Кнопка Save знайдена! Вішаємо обробник...");

            const handleSaveClick = async () => {
              try {
                console.log("🖱️ [SAVE] Натиснуто кнопку збереження!");
                const finalTimesCount = countTimes(timeInputs).length;
                console.log(`👉 Було часів: ${initialTimesCount}, Стало: ${finalTimesCount}`);

                updatedState = initUpdated();

                let isNewLoad = false;

                if (initialTimesCount !== finalTimesCount && !updatedState.updated.includes(fb)) {
                  updatedState.updated.push(fb);
                  updatedState.loads = (updatedState.loads || 0) + 1;
                  isNewLoad = true;
                }

                updatedState.updates = (updatedState.updates || 0) + 1;

                await StorageQueue.enqueue("updated", JSON.stringify(updatedState));
                showStats();
                console.log(`✅ [SAVE] Успіх! Updates: ${updatedState.updates}, Loads: ${updatedState.loads}. Новий вантаж: ${isNewLoad}`);
              } catch (error) {
                console.error("❌ Помилка при збереженні:", error);
              }
            };

            if (saveBtn._handleSaveClick) {
              saveBtn.removeEventListener("click", saveBtn._handleSaveClick);
            }

            saveBtn._handleSaveClick = handleSaveClick;
            saveBtn.addEventListener("click", handleSaveClick);

            timesObserver.disconnect();
          });

          timesObserver.observe(document.body, { childList: true, subtree: true });
        };

        // Видаляємо старий обробник, якщо він був
        if (editContainer._handleEditClick) {
          editContainer.removeEventListener("click", editContainer._handleEditClick);
        }

        // Вішаємо новий обробник на контейнер
        editContainer._handleEditClick = handleEditClick;
        editContainer.addEventListener("click", handleEditClick);
      }

      modalObserver.disconnect();
    });

    modalObserver.observe(document.body, { childList: true, subtree: true });
  });
})();
