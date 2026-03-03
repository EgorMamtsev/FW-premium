// ==UserScript==
// @name         Freight Watch Premium
// @namespace    http://tampermonkey.net/
// @version      2026-02-17
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
    filters: true,
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
    return document
      .querySelector("div.stops-wrapper")
      .querySelector("button.lgt-button-white");
  }

  function getComentField() {
    return document
      .querySelector("div.post-comment")
      .querySelector("textarea.cdk-textarea-autosize");
  }

  function getPostComentBtn() {
    return document
      .querySelector("lgt-form-actions.fit")
      .querySelector("button.lgt-button-primary");
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
    return document.querySelector("lgt-button.m-l-4");
  }

  //#endregion

  //#region Mark and Count updates

  // Ініціалізація локалсторедж
  function initUpdated() {
    let updatedLoads = localStorage.getItem("updated");

    if (!updatedLoads) {
      updatedLoads = { updates: 0, loads: 0, updated: [] };
      localStorage.setItem("updated", JSON.stringify(updatedLoads));
    } else {
      updatedLoads = JSON.parse(updatedLoads);
    }

    return updatedLoads;
  }

  // Викликаємо завжди, навіть якщо countUpdates=false або markUpdates=false
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

  //видаляє фб яких вже не має на сторінці
  function removerMissingLoads() {
    const tbody = getTbody();
    if (!tbody) return;

    const rows = Array.from(tbody.children);

    // FB які є зараз на сторінці
    const fbOnPage = rows.map((row) =>
      Number(row.children[1].textContent.trim()),
    );

    updatedState = initUpdated();

    const before = updatedState.updated.length;

    // залишаємо тільки ті FB, які ще є на сторінці
    updatedState.updated = updatedState.updated.filter((fb) =>
      fbOnPage.includes(Number(fb)),
    );

    if (before !== updatedState.updated.length) {
      localStorage.setItem("updated", JSON.stringify(updatedState));
    }
  }

  // Функція додавання FB у локалсторедж
  function saveLoad(fb) {
    if (!FUTURES.markUpdates) {
      return;
    }
    updatedState = initUpdated();

    if (!updatedState.updated.includes(fb)) {
      updatedState.updated.push(fb);
      localStorage.setItem("updated", JSON.stringify(updatedState));
    }
  }
  // додає +1 до loads, підрахунок вантажів
  function increaseLoad() {
    if (!FUTURES.countUpdates) {
      return;
    }
    updatedState = initUpdated();
    updatedState.loads += 1;
    localStorage.setItem("updated", JSON.stringify(updatedState));

    showStats(); // оновлення лічильника апдейтів createUpdatesCounter
  }
  // додає +1 до updates, підрахунок апдейтів

  function increaseUpdate() {
    if (!FUTURES.countUpdates) {
      return;
    }
    updatedState = initUpdated();
    updatedState.updates += 1;
    localStorage.setItem("updated", JSON.stringify(updatedState));

    showStats(); // оновлення лічильника апдейтів createUpdatesCounter
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
    let comments = localStorage.getItem("comments");

    if (!comments) {
      comments = [];
      localStorage.setItem("comments", JSON.stringify(comments));
    } else {
      comments = JSON.parse(comments);
    }

    return comments;
  }

  // Викликаємо завжди, навіть якщо comments=false
  let commentsState = initComments();

  // зберігає коментар у локал
  function saveComment(data) {
    if (!FUTURES.comments) {
      return;
    }
    commentsState = initComments();

    const index = commentsState.findIndex(
      (c) => Number(c.fb) === Number(data.fb),
    );

    if (index !== -1) {
      commentsState[index] = data;
    } else {
      commentsState.push(data);
    }

    localStorage.setItem("comments", JSON.stringify(commentsState));
  }
  // збирає обʼєкт коментаря який буде збережено
  function generateComment(fb, status, commentBox) {
    if (!FUTURES.comments) {
      return;
    }
    let willBeSaved = {};
    if (commentBox.children.length === 0) {
      willBeSaved = {
        fb: fb,
        comment: "no comments",
        status: status,
      };
    } else {
      willBeSaved = {
        fb: fb,
        status: status,
        comment: findComment(),
        commentTime: findCommentTime(),
        timeZone: findTimeZone(),
        inTime: findInTime(),
      };
    }
    saveComment(willBeSaved);
  }
  // знаходить текст коментаря
  function findComment() {
    let commentsBox = document.querySelector("div.comments__regular");
    let comment;
    if (commentsBox.children.length === 0) {
      return (comment = "no comments yet");
    } else {
      const commentBody = commentsBox.querySelector(".body1");
      comment = commentBody.textContent;
      if (comment.length > 50) {
        comment = `${comment.slice(0, 50)}...`;
      }
      return comment;
    }
  }

  // знаходить час коментаря
  function findCommentTime() {
    const commentTimeBox = document
      .querySelector("div.comments__regular")
      .querySelector("div.comment-container")
      .querySelector("span.date");

    const commentTime = `${commentTimeBox.textContent.at(
      -8,
    )}${commentTimeBox.textContent.at(-7)}${commentTimeBox.textContent.at(
      -6,
    )}${commentTimeBox.textContent.at(-5)}${commentTimeBox.textContent.at(
      -4,
    )}${commentTimeBox.textContent.at(-3)}${commentTimeBox.textContent.at(
      -2,
    )}${commentTimeBox.textContent.at(-1)}`;

    return commentTime;
  }

  //знаходить inTime
  function findInTime() {
    let findStops = document.querySelectorAll("div.stop-item");
    let pickUpDateItem = findStops[0].querySelectorAll("p.date");
    let delDateItem =
      findStops[findStops.length - 1].querySelectorAll("p.date");

    if (pickUpDateItem[2].textContent == "") {
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
    } else {
      let inTime = `${delDateItem[1].textContent.at(
        -5,
      )}${delDateItem[1].textContent.at(-4)}${delDateItem[1].textContent.at(
        -3,
      )}${delDateItem[1].textContent.at(-2)}${delDateItem[1].textContent.at(
        -1,
      )}`;

      return inTime;
    }
  }

  //знаходить часовий пояс
  function findTimeZone() {
    let findStops = document.querySelectorAll("div.stop-item");
    let pickUpDateItem = findStops[0].querySelectorAll("p.date");
    let findTimeZoneBox = document.querySelectorAll("p.m-b-1");

    if (!pickUpDateItem || !findStops || !findTimeZoneBox) {
      return;
    }

    if (pickUpDateItem[2].textContent == "") {
      let timeZone = `${findTimeZoneBox[0].textContent.at(
        -3,
      )}${findTimeZoneBox[0].textContent.at(
        -2,
      )}${findTimeZoneBox[0].textContent.at(-1)}`;
      return timeZone;
    } else {
      let timeZone = `${findTimeZoneBox[1].textContent.at(
        -3,
      )}${findTimeZoneBox[1].textContent.at(
        -2,
      )}${findTimeZoneBox[1].textContent.at(-1)}`;
      return timeZone;
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

    // Збираємо FB вантажів, які мають клас .orange
    const orangeFBs = rows
      .filter((r) => r.classList.contains("orange"))
      .map((r) => Number(r.children[1].textContent));

    // Видаляємо з локала коментарі для вантажів, яких більше немає з .orange
    commentsState = commentsState.filter((c) =>
      orangeFBs.includes(Number(c.fb)),
    );

    localStorage.setItem("comments", JSON.stringify(commentsState));
  }

  function postCommetn() {}

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
    // загальний блок для лейбла і підрахунку
    const item = document.createElement("div");
    item.classList.add("loads-counter__item", `loads-counter__item--${mod}`);

    // блок з підрахунком(числом)
    const numberOfLoads = document.createElement("div");
    numberOfLoads.classList.add("loads-counter__count");

    //текст елементу
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
    // батьківський контейнер
    const elemBeforeCounter = document.querySelector(".headline5");
    const counterContainer = createElem("div", "counterContainer");
    elemBeforeCounter.append(counterContainer);

    // Updates блок
    const updateCounter = createElem("div", "updateCounter");
    const updateLabel = createElem("div", "updateLabel", "Updates");
    const numberOfUpdates = createElem("div", "updateNumber");
    updateCounter.append(updateLabel, numberOfUpdates);
    counterContainer.append(updateCounter);

    // Loads блок
    const loadsCounter = createElem("div", "loadsCounter");
    const loadsLabel = createElem("div", "loadsLabel", "Loads");
    const numberOfLoads = createElem("div", "updateNumber");
    loadsCounter.append(loadsLabel, numberOfLoads);
    counterContainer.append(loadsCounter);

    // Clear button
    const clearBtn = createElem("button", "clearBtn", "Clear");
    counterContainer.append(clearBtn);
    clearBtn.addEventListener("click", function () {
      updatedState.updates = 0;
      updatedState.loads = 0;
      localStorage.setItem("updated", JSON.stringify(updatedState));
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

  //шаблон для створення елементів лічильника
  // function createElem(tag, className, textContent) {
  //   const el = document.createElement(tag);
  //   if (className) el.classList.add(className);
  //   if (textContent) el.textContent = textContent;
  //   return el;
  // }

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

    //батьківський контейнер
    const elemBefore = document.querySelector(".headline5");
    const filterCountainer = createElem("div", "filter-container");
    elemBefore.append(filterCountainer);
    // #region фільтр за статусом

    // блок фільтрів за статусом
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
      // очищаємо параметри фільтрів
      Object.keys(filterParams).forEach((k) => (filterParams[k] = []));

      // прибираємо галочки у всіх чекбоксів
      const allCheckboxes = document.querySelectorAll(
        ".filter-container input[type='checkbox']",
      );
      allCheckboxes.forEach((cb) => (cb.checked = false));

      // застосовуємо фільтри (усі рядки показуються)
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

    //need to check item
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

    //eta to pick up item
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

    //eta to del item
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

    //in transit item
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

    //at pick up item
    const atPickLabel = createElem("span", "at-pick__label", "At pickup");
    const atPickInput = createCheckBox("input", "filter__input", "checkbox", [
      "byStatus",
      "At Pickup",
    ]);
    atPickWrapper.append(atPickLabel, atPickInput);

    //at del item
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

    // NA item
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

    //#endregion
  }

  function applyFilters(params) {
    if (!FUTURES.filters) {
      return;
    }
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach((tr) => {
      let show = true;

      // ===== Фільтр по статусу =====
      if (params.byStatus.length > 0) {
        let statusText = tr.children[6]?.textContent.trim();

        // обрізаємо тільки для At Pickup / At Delivery
        if (statusText.startsWith("At Pickup")) {
          statusText = statusText.slice(0, 9); // "At Pickup"
        } else if (statusText.startsWith("At Delivery")) {
          statusText = statusText.slice(0, 9); // "At Delive"
        }

        if (!params.byStatus.includes(statusText)) {
          show = false;
        }
      }

      // ===== Фільтр по класу =====
      if (show && params.byClass.length > 0) {
        const rowClasses = Array.from(tr.classList);
        const matchesClass = params.byClass.some((cls) =>
          rowClasses.includes(cls),
        );
        if (!matchesClass) {
          show = false;
        }
      }

      //фільтр по даті
      if (params.byDate.length > 0) {
        let pickDate = tr.children[9]?.textContent.slice(0, 5).trim();
        let delDate = tr.children[12]?.textContent.slice(0, 5).trim();

        const matchesDate =
          params.byDate.includes(pickDate) || params.byDate.includes(delDate);

        if (!matchesDate) {
          show = false;
        }
      }

      // ===== Показати або сховати рядок =====
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
    // знаходимо всі stop-destination
    const stops = document.querySelectorAll(".stop-destination");

    // перевіряємо, що є елементи
    if (stops.length > 0) {
      const firstCity = stops[0].textContent.trim(); // перший
      const lastCity = stops[stops.length - 1].textContent.trim(); // останній

      return [firstCity, lastCity];
    }
  }

  //#endregion

  //#region Observers

  //обсервер вимикається при завантаженні таблиці ОБОВ'ЯЗКОВО ВИМИКАТИ ДО ІНШИХ ФУНКЦІЙ
  //для функцій які мають спрацювати лише раз

  const pageLoadingObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 30) {
      pageLoadingObserver.disconnect(); // вимикаєм до виклику функці

      createUpdatesCounter(); // створюємо лічильник апдейтів
      createFilters();

      hideSideBar(); // hide sidebar

      //очищення локала. видаляє фб та коменти
      removerMissingLoads(); //видаляємо коментарі
      cleanupComments(); //видалямо вантажі які зникли

      //створюємо лічільник
      createLoadsCounter();
      //обсервер на сторінку щоб бачити зміну кількості рядків
      const loadsCounterObserver = new MutationObserver(() => {
        startCount();
      });
      loadsCounterObserver.observe(getTbody(), {
        childList: true, // додавання/видалення рядків
        subtree: true, // зміни у вкладених елементах (наприклад, <td>)
        attributes: true, // зміни атрибутів
        attributeFilter: ["class"], // тільки якщо змінюється class
      });
    }
  });
  pageLoadingObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Observer на таблицю (перерендери), чекає завантаження таблиці та ПРАЦЮЄ ЗАВЖДИ
  const highlightObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 0) {
      restoreUpdatedRows(initUpdated()); //маркує вантажі
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
      const fbEl = document.querySelector(".m-r-1");
      const commentWrapper = document
        .querySelector("div.dispatch-comments")
        .querySelector("div.comments__regular");
      const editBnt = getEditBtn();
      const smsBtnContainer = getSMSbntContainer();

      if (
        !stopsWrapper ||
        !statusEl ||
        !fbEl ||
        !commentWrapper ||
        !editBnt ||
        !smsBtnContainer
      ) {
        return;
      }

      const status = statusEl.textContent.trim();
      const fbText = fbEl.textContent.trim();
      const fb = Number(fbText);

      if (!status || !fbText) return; //  чекаємо реальні текстові значення
      createGenerateTxtBtn(fb);

      //перевірка на статус для збереження коментаря
      if (status === "At Pickup" || status === "At Delivery") {
        generateComment(fb, status, commentWrapper);

        //клік на поле коментаря
        getComentField().addEventListener("click", () => {
          const postBnt = getPostComentBtn();
          //клік на кнопку post
          postBnt.addEventListener("click", () => {
            const date = new Date();

            //зберігажмо коментар який написали
            saveComment({
              fb: fb,
              status: status,
              comment: getComentField().value, //викликаємо з тим що написано
              commentTime: `${date.getHours()}:${date.getMinutes()}`, // отримуємо наявний час
              timeZone: findTimeZone(),
              inTime: findInTime(),
            });
          });
        });
      }

      // обробник на кнопку редагування
      if (editBnt) {
        editBnt.addEventListener(
          "click",
          () => {
            const timesObserver = new MutationObserver((mutations, obs) => {
              const timesWrapper = document.querySelector("div.m-y-5");

              if (!timesWrapper) {
                return;
              }
              const timeInputs = timesWrapper.querySelectorAll(
                "input.mat-mdc-input-element",
              );
              const onFirstOpenTimes = countTimes(timeInputs); // зберігаємо кількість заповнених полів часу

              // обробник кнопки save
              const saveBtn = getSaveBtn();
              if (!saveBtn) {
                return;
              }

              saveBtn.addEventListener("click", () => {
                const timesAfterUpdate = countTimes(timeInputs);

                if (onFirstOpenTimes.length !== timesAfterUpdate.length) {
                  increaseUpdate();
                  if (!updatedState.updated.includes(fb)) {
                    increaseLoad();
                    saveLoad(fb);
                  }
                  return;
                }

                increaseUpdate();
              });
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

      // після того як дані з модалки доступні — вимикаємо observer
      modalObserver.disconnect();
    });

    modalObserver.observe(document.body, { childList: true, subtree: true });
  });
})();
