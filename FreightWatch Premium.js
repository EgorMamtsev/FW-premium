// ==UserScript==
// @name         Freight Watch Premium
// @namespace    http://tampermonkey.net/
// @version      2026-02-20
// @description  You will see
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
    return document.querySelector("button.m-l-4");
  }

  function getEditBtn() {
    try {
      const stopsWrapper = document.querySelector("div.stops-wrapper");
      if (!stopsWrapper) return null;

      return stopsWrapper.querySelector("button.lgt-button-white");
    } catch (error) {
      console.error("❌ Помилка в getEditBtn:", error);
      return null;
    }
  }

  function getComentField() {
    try {
      const postComment = document.querySelector("div.post-comment");
      if (!postComment) return null;

      return postComment.querySelector("textarea.cdk-textarea-autosize");
    } catch (error) {
      console.error("❌ Помилка в getComentField:", error);
      return null;
    }
  }

  function getPostComentBtn() {
    try {
      const formActions = document.querySelector("lgt-form-actions.fit");
      if (!formActions) return null;

      return formActions.querySelector("button.lgt-button-primary");
    } catch (error) {
      console.error("❌ Помилка в getPostComentBtn:", error);
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
    const lgtBtn = document.querySelector("lgt-button.m-l-4");
    return lgtBtn?.closest(".row-item");
  }

  //#endregion

  //#region Mark and Count updates

  // ====== STORAGE QUEUE SYSTEM ======
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
          console.log(`✅ Saved to localStorage: ${key}`);
          resolve(true);
        } catch (error) {
          console.error(`❌ Failed to save ${key}:`, error);
          resolve(false);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      isProcessing = false;
    };

    return {
      enqueue: (key, value) => {
        return new Promise((resolve) => {
          queue.push({ key, value, resolve });
          process();
        });
      },
      read: (key, defaultValue) => {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
          console.error(`❌ Failed to read ${key}:`, error);
          return defaultValue;
        }
      },
    };
  })();

  // Ініціалізація локалсторедж
  function initUpdated() {
    return StorageQueue.read("updated", {
      updates: 0,
      loads: 0,
      updated: [],
    });
  }

  let updatedState = initUpdated();

  // Функція для підсвітки рядків
  function restoreUpdatedRows(updatedState) {
    if (!FUTURES.markUpdates) {
      return;
    }
    if (!getTbody()) {
      return;
    }

    const rows = Array.from(getTbody().children);

    rows.forEach((row) => {
      const fb = Number(row.children[1].textContent);

      if (
        updatedState.updated.includes(fb) &&
        !row.children[1].classList.contains("updated")
      ) {
        row.children[1].classList.add("updated");
      }
    });
  }

  //видаляє фб яких вже не має на сторінц��
  function removerMissingLoads() {
    const tbody = getTbody();
    if (!tbody) return;

    const rows = Array.from(tbody.children);

    const fbOnPage = rows.map((row) =>
      Number(row.children[1].textContent.trim()),
    );

    updatedState = initUpdated();

    const before = updatedState.updated.length;

    updatedState.updated = updatedState.updated.filter((fb) =>
      fbOnPage.includes(Number(fb)),
    );

    if (before !== updatedState.updated.length) {
      StorageQueue.enqueue("updated", JSON.stringify(updatedState));
    }
  }

  // Функція додавання FB у локалсторедж - ВИПРАВЛЕНА
  async function increaseLoad() {
    if (!FUTURES.countUpdates) {
      console.warn("⚠️ countUpdates disabled");
      return false;
    }

    try {
      updatedState = initUpdated();
      updatedState.loads = (updatedState.loads || 0) + 1;
      console.log(`📈 Loads: ${updatedState.loads}`);

      // ⭐ ЧЕКАЄМО збереження
      await StorageQueue.enqueue("updated", JSON.stringify(updatedState));

      showStats();
      return true;
    } catch (error) {
      console.error("❌ Помилка в increaseLoad:", error);
      return false;
    }
  }

  async function increaseUpdate() {
    if (!FUTURES.countUpdates) {
      console.warn("⚠️ countUpdates disabled");
      return false;
    }

    try {
      updatedState = initUpdated();
      updatedState.updates = (updatedState.updates || 0) + 1;
      console.log(`📊 Updates: ${updatedState.updates}`);

      // ⭐ ЧЕКАЄМО збереження
      await StorageQueue.enqueue("updated", JSON.stringify(updatedState));

      showStats();
      return true;
    } catch (error) {
      console.error("❌ Помилка в increaseUpdate:", error);
      return false;
    }
  }

  async function saveLoad(fb) {
    if (!FUTURES.markUpdates) {
      console.warn("⚠️ markUpdates disabled");
      return false;
    }

    try {
      updatedState = initUpdated();

      if (!updatedState.updated.includes(fb)) {
        updatedState.updated.push(fb);
        console.log(`📝 Додаємо FB ${fb} до updated`);

        // ⭐ ЧЕКАЄМО збереження
        await StorageQueue.enqueue("updated", JSON.stringify(updatedState));

        return true;
      }

      console.log(`⚠️ FB ${fb} вже є в updated`);
      return false;
    } catch (error) {
      console.error("❌ Помилка в saveLoad:", error);
      return false;
    }
  }

  // рахує кількість заповнених інпутів часу для порівняння і розуміння +loads або +updates
  function countTimes(range) {
    const times = [];
    for (let i = 0; i < range.length; i += 1) {
      if (range[i].value != "") {
        times.push(range[i].value);
      }
    }

    return times;
  }

  //#endregion

  //#region Comments

  //отримуємо коментарі з локала
  function initComments() {
    return StorageQueue.read("comments", []);
  }

  let commentsState = initComments();

  // зберігає коментар у локал - ВИПРАВЛЕНА
  function saveComment(data) {
    if (!FUTURES.comments) {
      console.warn("⚠️ Comments disabled in FUTURES");
      return false;
    }

    if (!data || typeof data.fb === "undefined") {
      console.error("❌ Invalid comment data:", data);
      return false;
    }

    try {
      commentsState = initComments();

      if (!Array.isArray(commentsState)) {
        console.error("❌ Comments state is not an array, resetting");
        commentsState = [];
      }

      const index = commentsState.findIndex(
        (c) => Number(c.fb) === Number(data.fb),
      );

      if (index !== -1) {
        console.log(`📝 Оновлення коментара для FB ${data.fb}`);
        commentsState[index] = data;
      } else {
        console.log(`📝 Додавання нового коментара для FB ${data.fb}`);
        commentsState.push(data);
      }

      StorageQueue.enqueue("comments", JSON.stringify(commentsState));
      console.log("✅ Коментар успішно збережений");
      return true;
    } catch (error) {
      console.error("❌ Error in saveComment:", error);
      return false;
    }
  }

  // збирає обʼєкт коментаря який буде збережено - ВИПРАВЛЕНА
  function generateComment(fb, status, commentBox) {
    if (!FUTURES.comments) {
      return;
    }

    try {
      let willBeSaved = {
        fb: fb,
        status: status,
        comment: "no comments",
        timestamp: new Date().toISOString(),
      };

      if (commentBox && commentBox.children && commentBox.children.length > 0) {
        try {
          const comment = findComment() || "no comments yet";
          const commentTime = findCommentTime ? findCommentTime() : null;
          const timeZone = findTimeZone ? findTimeZone() : null;
          const inTime = findInTime ? findInTime() : null;

          willBeSaved = {
            ...willBeSaved,
            comment: comment,
            commentTime: commentTime,
            timeZone: timeZone,
            inTime: inTime,
          };
        } catch (error) {
          console.error("❌ Error reading comment data:", error);
        }
      }

      saveComment(willBeSaved);
    } catch (error) {
      console.error("❌ Error in generateComment:", error);
    }
  }

  // знаходить текст коментаря - ВИПРАВЛЕНА
  // знаходить текст коментаря - ВИПРАВЛЕНА
  function findComment() {
    try {
      let commentsBox = document.querySelector("div.comments__regular");
      if (!commentsBox) return "no comments yet";

      if (commentsBox.children.length === 0) {
        return "no comments yet";
      } else {
        const commentBody = commentsBox.querySelector(".body1");
        if (!commentBody) return "no comments yet";

        let comment = commentBody.textContent;
        if (comment.length > 50) {
          comment = `${comment.slice(0, 50)}...`;
        }
        return comment;
      }
    } catch (error) {
      console.error("❌ Error in findComment:", error);
      return "no comments yet";
    }
  }

  // знаходить час коментаря - ВИПРАВЛЕНА
  function findCommentTime() {
    try {
      const commentTimeBox = document.querySelector("div.comments__regular");
      if (!commentTimeBox) return null;

      const commentContainer = commentTimeBox.querySelector(
        "div.comment-container",
      );
      if (!commentContainer) return null;

      const dateSpan = commentContainer.querySelector("span.date");
      if (!dateSpan) return null;

      const commentTime = `${dateSpan.textContent.at(
        -8,
      )}${dateSpan.textContent.at(-7)}${dateSpan.textContent.at(
        -6,
      )}${dateSpan.textContent.at(-5)}${dateSpan.textContent.at(
        -4,
      )}${dateSpan.textContent.at(-3)}${dateSpan.textContent.at(
        -2,
      )}${dateSpan.textContent.at(-1)}`;

      return commentTime;
    } catch (error) {
      console.error("❌ Error in findCommentTime:", error);
      return null;
    }
  }

  //знаходить inTime - ВИПРАВЛЕНА
  function findInTime() {
    try {
      let findStops = document.querySelectorAll("div.stop-item");
      if (!findStops || findStops.length === 0) return null;

      let pickUpDateItem = findStops[0].querySelectorAll("p.date");
      let delDateItem =
        findStops[findStops.length - 1].querySelectorAll("p.date");

      if (!pickUpDateItem || !delDateItem) return null;

      if (pickUpDateItem[2] && pickUpDateItem[2].textContent == "") {
        let inTime = `${pickUpDateItem[1].textContent.at(
          -5,
        )}${pickUpDateItem[1].textContent.at(
          -4,
        )}${pickUpDateItem[1].textContent.at(
          -3,
        )}${pickUpDateItem[1].textContent.at(
          -2,
        )}${pickUpDateItem[1].textContent.at(-1)}`;

        return inTime;
      } else if (delDateItem[1]) {
        let inTime = `${delDateItem[1].textContent.at(
          -5,
        )}${delDateItem[1].textContent.at(-4)}${delDateItem[1].textContent.at(
          -3,
        )}${delDateItem[1].textContent.at(-2)}${delDateItem[1].textContent.at(
          -1,
        )}`;

        return inTime;
      }
      return null;
    } catch (error) {
      console.error("❌ Error in findInTime:", error);
      return null;
    }
  }

  //знаходить часовий пояс - ВИПРАВЛЕНА
  function findTimeZone() {
    try {
      let findStops = document.querySelectorAll("div.stop-item");
      let pickUpDateItem = findStops[0].querySelectorAll("p.date");
      let findTimeZoneBox = document.querySelectorAll("p.m-b-1");

      if (!pickUpDateItem || !findStops || !findTimeZoneBox) {
        return null;
      }

      if (pickUpDateItem[2] && pickUpDateItem[2].textContent == "") {
        let timeZone = `${findTimeZoneBox[0].textContent.at(
          -3,
        )}${findTimeZoneBox[0].textContent.at(
          -2,
        )}${findTimeZoneBox[0].textContent.at(-1)}`;
        return timeZone;
      } else if (findTimeZoneBox[1]) {
        let timeZone = `${findTimeZoneBox[1].textContent.at(
          -3,
        )}${findTimeZoneBox[1].textContent.at(
          -2,
        )}${findTimeZoneBox[1].textContent.at(-1)}`;
        return timeZone;
      }
      return null;
    } catch (error) {
      console.error("❌ Error in findTimeZone:", error);
      return null;
    }
  }

  //малює коменти в таблицю
  function restoreComments() {
    if (!FUTURES.comments) {
      return;
    }
    const commentInterwal = setInterval(() => {
      commentsState = initComments();
      const tbody = getTbody();
      if (!tbody) return;

      const rows = Array.from(tbody.children);

      rows.forEach((row) => {
        const fb = Number(row.children[1].textContent);

        const commentData = commentsState.find((c) => Number(c.fb) === fb);

        if (!commentData) return;

        if (row.children[6]) {
          row.children[6].textContent =
            `${commentData.status || ""} ${commentData.inTime || ""} ${commentData.timeZone || ""}`.trim();
        }

        if (row.children[7]) {
          row.children[7].textContent =
            `${commentData.commentTime || ""} ${commentData.comment || ""}`.trim();
        }
      });
    }, 500);
  }
  restoreComments();

  //видаляє коментрарі
  function cleanupComments() {
    commentsState = initComments();
    const tbody = getTbody();
    if (!tbody) return;

    const rows = Array.from(tbody.children);

    const orangeFBs = rows
      .filter((r) => r.classList.contains("orange"))
      .map((r) => Number(r.children[1].textContent));

    commentsState = commentsState.filter((c) =>
      orangeFBs.includes(Number(c.fb)),
    );

    StorageQueue.enqueue("comments", JSON.stringify(commentsState));
  }

  //#endregion

  //#region LoadsCounter

  const counters = {};

  //створюємо лічильник
  function createLoadsCounter() {
    if (!FUTURES.loadsCounter) {
      return;
    }
    const container = document.querySelector(".m-b-2");
    const dispatchDeliveredBnts = document.querySelector(
      ".toggle-buttons-wrapper",
    );

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
      counters.whiteLoads.element,
      counters.pinkLoads.element,
      counters.yellowLoads.element,
      counters.greenLoads.element,
      counters.noAnswerLoads.element,
      counters.totatlLoads.element,
    );
  }

  //функція шаблон для створення елементів лічильника
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

  // функції рахування
  function countPink() {
    const pinkLoads = getTbody().querySelectorAll("tr.pink");
    const countPink = pinkLoads.length;
    counters.pinkLoads.numberOfElem.textContent = countPink;
  }

  function countYellow() {
    const yellowLoads = getTbody().querySelectorAll("tr.orange");
    const countYellow = yellowLoads.length;
    counters.yellowLoads.numberOfElem.textContent = countYellow;
  }

  function countGreen() {
    const greenLoads = getTbody().querySelectorAll("tr.green");
    const countGreen = greenLoads.length;
    counters.greenLoads.numberOfElem.textContent = countGreen;
  }

  function countNAloads() {
    const noAnswerLoads = getTbody().querySelectorAll("tr.red");
    const countNA = noAnswerLoads.length;
    counters.noAnswerLoads.numberOfElem.textContent = countNA;
  }

  function countTotal() {
    const totatlLoads = getTbody().querySelectorAll("tr");
    const countTotal = totatlLoads.length;
    counters.totatlLoads.numberOfElem.textContent = countTotal;
  }

  function countWhiteLoads() {
    const total = getTbody().querySelectorAll("tr").length;
    const colored = getTbody().querySelectorAll(
      "tr.pink, tr.orange, tr.green, tr.red",
    ).length;

    const count = total - colored;

    counters.whiteLoads.numberOfElem.textContent = count;
  }

  //функція починає рахувати
  function startCount() {
    if (!FUTURES.loadsCounter) {
      return;
    }
    countWhiteLoads();
    countPink();
    countYellow();
    countGreen();
    countNAloads();
    countTotal();
  }
  //#endregion

  //#region UpdatesCounter

  function createUpdatesCounter() {
    if (!FUTURES.updatesCounter) {
      return;
    }
    const elemBeforeCounter = document.querySelector(".headline5");
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
    if (!FUTURES.updatesCounter) {
      return;
    }
    document.querySelector(".updateCounter .updateNumber").textContent =
      updatedState.updates;
    document.querySelector(".loadsCounter .updateNumber").textContent =
      updatedState.loads;
  }

  //#endregion

  //#region Hide SideBar
  function hideSideBar() {
    if (!FUTURES.hideSideBar) {
      return;
    }

    const sideBtn = document.querySelector(".side-menu__toggle");
    sideBtn.click();
  }
  //#endregion

  //#region Filters

  function createFilters() {
    if (!FUTURES.filters) {
      return;
    }

    const elemBefore = document.querySelector(".headline5");
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

      const allCheckboxes = document.querySelectorAll(
        ".filter-container input[type='checkbox']",
      );
      allCheckboxes.forEach((cb) => (cb.checked = false));

      applyFilters(filterParams);
    });
    filterCountainer.append(clearFilters);

    filterByStatus.append(
      needToCheckWrapper,
      inTransitWrapper,
      etaToPickWrapper,
      etaToDeliveryWrapper,
      atPickWrapper,
      atDeliveryWrapper,
      noAnswerWrapper,
      todayDateWrapper,
    );

    const needToCheckLabel = createElem(
      "span",
      "need-to-check__label",
      "Need to check",
    );
    const needToCheckInput = createCheckBox(
      "input",
      "filter__input",
      "checkbox",
      ["byStatus", "Need to check"],
    );

    needToCheckWrapper.append(needToCheckLabel, needToCheckInput);

    const etaToPiclabel = createElem(
      "span",
      "eta-to-pick__label",
      "ETA to pickup",
    );
    const etaToPicInput = createCheckBox("input", "filter__input", "checkbox", [
      "byStatus",
      "ETA Pickup",
    ]);
    etaToPickWrapper.append(etaToPiclabel, etaToPicInput);

    const etaToDeliverylabel = createElem(
      "span",
      "eta-to-delivery__label",
      "ETA to delivery",
    );
    const etaToDeliveryInput = createCheckBox(
      "input",
      "filter__input",
      "checkbox",
      ["byStatus", "ETA Delivery"],
    );
    etaToDeliveryWrapper.append(etaToDeliverylabel, etaToDeliveryInput);

    const inTransitLabel = createElem(
      "span",
      "in-transit__label",
      "In transit",
    );
    const inTransitInput = createCheckBox(
      "input",
      "filter__input",
      "checkbox",
      ["byStatus", "In Transit/Loaded"],
    );
    inTransitWrapper.append(inTransitLabel, inTransitInput);

    const atPickLabel = createElem("span", "at-pick__label", "At pickup");
    const atPickInput = createCheckBox("input", "filter__input", "checkbox", [
      "byStatus",
      "At Pickup",
    ]);
    atPickWrapper.append(atPickLabel, atPickInput);

    const atDeliveryLabel = createElem(
      "span",
      "at-delivery__label",
      "At delivery",
    );
    const atDeliveryInput = createCheckBox(
      "input",
      "filter__input",
      "checkbox",
      ["byStatus", "At Delive"],
    );
    atDeliveryWrapper.append(atDeliveryLabel, atDeliveryInput);

    const noAnswerLabel = createElem("span", "no-answer__label", "N/A");
    const noAnswerInput = createCheckBox("input", "filter__input", "checkbox", [
      "byClass",
      "red",
    ]);
    noAnswerWrapper.append(noAnswerLabel, noAnswerInput);

    const todayLabel = createElem("span", "today-date__label", "Today");

    const todayInput = createCheckBox(
      "input",
      "today-date__input",
      "checkbox",
      ["byDate", getTodayDate()],
    );
    todayDateWrapper.append(todayLabel, todayInput);
  }

  function applyFilters(params) {
    if (!FUTURES.filters) {
      return;
    }
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach((tr) => {
      let show = true;

      if (params.byStatus.length > 0) {
        let statusText = tr.children[6]?.textContent.trim();

        if (statusText.startsWith("At Pickup")) {
          statusText = statusText.slice(0, 9);
        } else if (statusText.startsWith("At Delivery")) {
          statusText = statusText.slice(0, 9);
        }

        if (!params.byStatus.includes(statusText)) {
          show = false;
        }
      }

      if (show && params.byClass.length > 0) {
        const rowClasses = Array.from(tr.classList);
        const matchesClass = params.byClass.some((cls) =>
          rowClasses.includes(cls),
        );
        if (!matchesClass) {
          show = false;
        }
      }

      if (params.byDate.length > 0) {
        let pickDate = tr.children[9]?.textContent.slice(0, 5).trim();
        let delDate = tr.children[12]?.textContent.slice(0, 5).trim();

        const matchesDate =
          params.byDate.includes(pickDate) || params.byDate.includes(delDate);

        if (!matchesDate) {
          show = false;
        }
      }

      tr.style.display = show ? "" : "none";
    });
  }

  function addFilterParams(filterType, query, checked) {
    if (!FUTURES.filters) {
      return;
    }
    const arr = filterParams[filterType];
    if (checked) {
      if (!arr.includes(query)) arr.push(query);
    } else {
      const index = arr.indexOf(query);
      if (index > -1) arr.splice(index, 1);
    }

    applyFilters(filterParams);
  }

  //#endregion

  //#region Generage SMS

  function createGenerateTxtBtn(fbNum) {
    if (!FUTURES.generateSMS) {
      return;
    }

    if (document.querySelector("button.generate-txt-btn ")) {
      return;
    }
    const btnContainer = getSMSbntContainer();

    const generateTxtBnt = createElem("button", "generate-txt-btn", "SMS");

    btnContainer.append(generateTxtBnt);

    generateTxtBnt.addEventListener("click", () => {
      generateTxtMessage(dispName, fbNum);
    });
  }

  function generateTxtMessage(name, fbNum) {
    const cities = getStops();
    const message = `Hello , this is ${name} with Landstar Dispatch.\nRegarding load ${cities[0]} -> ${cities[1]} FB# ${fbNum} — `;
    getComentField().value = message;
  }

  function getStops() {
    const stops = document.querySelectorAll(".stop-destination");

    if (stops.length > 0) {
      const firstCity = stops[0].textContent.trim();
      const lastCity = stops[stops.length - 1].textContent.trim();

      return [firstCity, lastCity];
    }
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
      const loadsCounterObserver = new MutationObserver(() => {
        startCount();
      });
      loadsCounterObserver.observe(getTbody(), {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  });
  pageLoadingObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const highlightObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 0) {
      restoreUpdatedRows(initUpdated());
    }
  });

  highlightObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  //#endregion

  // Обробка кліку на рядок
  document.body.addEventListener("click", (e) => {
    const row = e.target.closest("tr.ng-star-inserted");
    if (!row) {
      return;
    }

    // Observer на модальне вікно
    const modalObserver = new MutationObserver((mutations, obs) => {
      const stopsWrapper = document.querySelector("div.stops-wrapper");
      const statusEl = document.querySelector("span.mat-mdc-select-min-line");
      const fbEl = document.querySelector(".m-r-1 a");
      const commentWrapper = document
        .querySelector("div.dispatch-comments")
        ?.querySelector("div.comments__regular");
      const editBnt = getEditBtn();
      const smsBtnContainer = getSMSbntContainer();
      const commentField = getComentField();
      const fb = Number(fbEl.textContent.trim());
      const status = statusEl.textContent.trim();

      // чекаємо всі потрібні елементи
      if (
        !stopsWrapper ||
        !statusEl ||
        !fbEl ||
        !fb ||
        !status ||
        !commentWrapper ||
        !editBnt ||
        !smsBtnContainer ||
        !commentField
      ) {
        return;
      }

      console.log("=== ПОЧАТОК ОБРОБКИ ===");
      console.log("FB отриманий:", fb);
      console.log("Тип FB:", typeof fb);
      console.log("FB === 0?", fb === 0);
      console.log("isNaN(fb)?", isNaN(fb));

      // створюємо кнопку SMS
      createGenerateTxtBtn(fb);

      // --- Comment поле ---
      if (status === "At Pickup" || status === "At Delivery") {
        generateComment(fb, status, commentWrapper);

        commentField.addEventListener(
          "click",
          () => {
            const postBtn = getPostComentBtn();
            if (!postBtn) return;

            // ⭐ Іменована функція для правильного видалення
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
                console.log("✅ Коментар збережений");
              } catch (error) {
                console.error("❌ Помилка:", error);
              }
            };

            // ⭐ Видалити попередній listener
            if (postBtn._handlePostClick) {
              postBtn.removeEventListener("click", postBtn._handlePostClick);
            }

            // ⭐ Зберегти нову функцію
            postBtn._handlePostClick = handlePostClick;
            postBtn.addEventListener("click", handlePostClick);
          },
          { once: true },
        ); // ⭐ { once: true } - listener спрацьовує один раз!
      }

      // --- Edit + Save поле ---
      if (editBnt) {
        editBnt.addEventListener(
          "click",
          () => {
            const timesObserver = new MutationObserver(() => {
              const timesWrapper = document.querySelector("div.m-y-5");
              if (!timesWrapper) return;

              const timeInputs = timesWrapper.querySelectorAll(
                "input.mat-mdc-input-element",
              );

              // ⭐ Отримуємо кількість часів при завантаженні модалки
              const initialTimesCount = countTimes(timeInputs).length;
              console.log(
                "🕐 При завантаженні модалки було часів:",
                initialTimesCount,
              );

              const saveBtn = getSaveBtn();
              if (!saveBtn) return;

              const handleSaveClick = async () => {
                try {
                  console.log("=== SAVE CLICKED ===");

                  const finalTimesCount = countTimes(timeInputs).length;
                  console.log("🕐 Після редагування часів:", finalTimesCount);

                  // ⭐ Читаємо ТІ ЖЕ дані що були при завантаженні
                  updatedState = initUpdated();
                  console.log(
                    "FB у updated ДО:",
                    updatedState.updated.includes(fb),
                  );

                  let isNewLoad = false;

                  if (
                    initialTimesCount !== finalTimesCount &&
                    !updatedState.updated.includes(fb)
                  ) {
                    console.log("✅ НОВИЙ LOAD - додаємо");
                    isNewLoad = true;

                    // ⭐ Додаємо FB у ЛО��АЛЬНИЙ updated array
                    updatedState.updated.push(fb);
                    updatedState.loads = (updatedState.loads || 0) + 1;
                    console.log(
                      `📝 Локально додали FB ${fb}, loads=${updatedState.loads}`,
                    );

                    // ⭐ Записуємо ВСЕ за один раз
                    await StorageQueue.enqueue(
                      "updated",
                      JSON.stringify(updatedState),
                    );
                    console.log("✅ Записано в localStorage");
                  }

                  // ⭐ Updates ЗАВЖДИ додаємо
                  updatedState.updates = (updatedState.updates || 0) + 1;
                  await StorageQueue.enqueue(
                    "updated",
                    JSON.stringify(updatedState),
                  );
                  console.log(`📊 Updates=${updatedState.updates}`);

                  showStats();
                  console.log("✅ Все завершено");
                } catch (error) {
                  console.error("❌ Помилка:", error);
                }
              };

              if (saveBtn._handleSaveClick) {
                saveBtn.removeEventListener("click", saveBtn._handleSaveClick);
              }

              saveBtn._handleSaveClick = handleSaveClick;
              saveBtn.addEventListener("click", handleSaveClick);

              console.log("✅ Listener додано на SAVE кнопку");

              timesObserver.disconnect();
            });

            timesObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });
          },
          { once: true },
        );
      }

      // observer можна вимкнути, бо все налаштовано
      modalObserver.disconnect();
    });

    modalObserver.observe(document.body, { childList: true, subtree: true });
  });
})();
