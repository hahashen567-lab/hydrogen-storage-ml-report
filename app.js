(() => {
  const data = window.REPORT_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const formulaHtml = (value = "") => esc(value).replace(/(\d+)/g, "<sub>$1</sub>");
  const shortModel = (name = "") => name.replace(/\s*[（(][^）)]*[）)]\s*/g, "").trim();
  let axis = "materialTags";
  let axisFilter = "";
  let matrixFilter = null;
  let searchQuery = "";
  let visibleLimit = 12;

  const outputSearchSynonyms = {
    "储氢容量/含量": ["储氢量", "储氢容量", "储氢含量", "储氢分数", "氢质量分数", "最大吸氢容量", "吸氢容量", "放氢容量", "H/M", "wt%", "wt.%", "W_H2", "Ab_Max", "capacity", "hydrogen uptake"],
    "氢化/反应焓": ["氢化焓", "吸氢焓", "放氢焓", "反应焓", "氢化物形成焓", "形成焓", "formation enthalpy", "hydrogenation enthalpy", "dehydrogenation enthalpy", "reaction enthalpy", "ΔH", "δH"],
    "形成能/稳定性": ["形成能", "生成能", "稳定性", "凸包能", "分解能", "formation energy", "energy above hull", "decomposition energy", "stability"],
    "平衡压力/PCT": ["平衡压力", "平台压力", "室温平衡压力", "PCT", "PCI", "Peq", "plateau pressure", "equilibrium pressure"],
    "吸放氢动力学": ["吸氢速率", "放氢速率", "吸氢时间", "放氢时间", "吸放氢时间", "动力学", "活化能", "0.2C", "1C", "kinetics", "reaction rate", "activation energy", "absorption time", "desorption time"],
    "循环/活化/衰减": ["循环寿命", "循环稳定性", "容量保持率", "衰减", "老化", "活化性能", "80%Age", "cycle", "cycling", "aging", "initial activation"],
    "氢扩散/迁移": ["氢扩散", "扩散系数", "迁移势垒", "扩散势垒", "diffusion", "diffusivity", "migration barrier", "MSD"],
    "相/结构/分类": ["相结构", "晶体结构", "相分类", "结构分类", "反应器分类", "翅片", "phase", "crystal structure", "reactor", "classification"],
    "力学性质": ["力学性质", "弹性模量", "体模量", "剪切模量", "硬度", "mechanical", "elastic modulus", "bulk modulus", "shear modulus"],
    "候选筛选/逆向设计": ["候选筛选", "材料筛选", "候选排序", "逆向设计", "screening", "candidate ranking", "inverse design"],
    "数据库/平台/综述": ["数据库", "平台", "综述", "database", "platform", "review", "benchmark"],
  };

  const normalizeSearch = (value = "") => String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-–—·、，,。.;；:：()[\]{}]/g, "");

  function resolvedOutputConcepts(query) {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return Object.entries(outputSearchSynonyms)
      .filter(([label, aliases]) => [label, ...aliases].some((alias) => {
        const normalizedAlias = normalizeSearch(alias);
        return normalizedAlias.includes(normalized) || normalized.includes(normalizedAlias);
      }))
      .map(([label]) => label);
  }

  $("#version").textContent = data.meta.version;
  $("#report-title").textContent = data.meta.title;
  $("#author").textContent = data.meta.author;
  $("#advisor").textContent = data.meta.advisor;
  $("#institution").textContent = data.meta.institution;

  $("#forward-diagnostics-image").src = data.assets.forwardDiagnostics;
  $("#reverse-diagnostics-image").src = data.assets.reverseDiagnostics;
  $("#forward-shap-image").src = data.assets.forwardShap;
  $("#reverse-shap-image").src = data.assets.reverseShap;
  $("#forward-score-image").src = data.assets.forwardScoreDiagnostics;
  $("#reverse-score-image").src = data.assets.reverseScoreDiagnostics;
  $("#cross-flow-image").src = data.assets.crossFlowOverlap;
  $("#reverse-external-image").src = data.assets.reverseExternal;
  $("#mp-funnel-image").src = data.assets.mpFunnel;
  $("#mp-rare-earth-image").src = data.assets.mpRareEarth;
  $("#jarvis-funnel-image").src = data.assets.jarvisFunnel;
  $("#jarvis-rare-earth-image").src = data.assets.jarvisRareEarth;
  $("#hydpark-overview-image").src = data.assets.hydparkOverview;
  $("#hydpark-consistency-image").src = data.assets.hydparkConsistency;

  const origin = data.methodOrigin;
  $("#origin-title").textContent = origin.title;
  $("#origin-role").textContent = origin.role;
  $("#origin-meta").innerHTML = `${esc(origin.authors)} · ${esc(origin.journal)} · <a href="https://doi.org/${esc(origin.doi)}" target="_blank" rel="noreferrer">DOI: ${esc(origin.doi)}</a>`;
  $("#origin-evidence").innerHTML = origin.evidence.map((item) => `<li>${esc(item)}</li>`).join("");

  const forwardBest = data.forward.metrics.find((item) => shortModel(item.model) === data.forward.summary.champion_model) || data.forward.metrics[0];
  $("#forward-model").textContent = shortModel(forwardBest.model);
  $("#best-r2").textContent = forwardBest.testR2.toFixed(3);
  $("#best-rmse").textContent = `${forwardBest.testRMSE.toFixed(3)} eV/atom`;
  $("#best-mae").textContent = `${forwardBest.testMAE.toFixed(3)} eV/atom`;
  $("#model-table").innerHTML = data.forward.metrics.map((model) => `
    <tr><td>${esc(shortModel(model.model))}</td><td>${model.testR2.toFixed(3)}</td><td>${model.testRMSE.toFixed(3)}</td><td>${model.testMAE.toFixed(3)}</td></tr>
  `).join("");

  const reverse = data.reverse;
  const externalMaximum = reverse.externalValidation.find((item) => item.comparison.includes("实验最大")) || reverse.externalValidation[0];
  $("#reverse-model").textContent = shortModel(reverse.summary.champion_model);
  $("#reverse-holdout-r2").textContent = reverse.holdout.testR2.toFixed(3);
  $("#reverse-holdout-rmse").innerHTML = `${(reverse.holdout.testRMSE * 100).toFixed(3)} wt.%<small>原始比例 ${reverse.holdout.testRMSE.toFixed(4)}</small>`;
  $("#reverse-external-mae").textContent = `${externalMaximum.maeWtPct.toFixed(3)} wt.%`;
  $("#reverse-model-table").innerHTML = reverse.tunedMetrics.map((model) => `
    <tr><td>${esc(shortModel(model.model))}${model.withinOneSE ? " · one-SE" : ""}</td><td>${model.testR2.toFixed(3)}</td><td>${model.cvBestRMSE.toFixed(4)}</td><td>${model.cvStability.toFixed(3)}</td></tr>
  `).join("");

  function bindTableToggle(buttonSelector, wrapSelector, openText, closeText) {
    $(buttonSelector).addEventListener("click", (event) => {
      const wrap = $(wrapSelector);
      wrap.hidden = !wrap.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!wrap.hidden));
      event.currentTarget.textContent = wrap.hidden ? openText : closeText;
    });
  }

  bindTableToggle("#toggle-models", "#model-table-wrap", "展开正向七模型调参结果", "收起正向七模型调参结果");
  bindTableToggle("#toggle-reverse-models", "#reverse-model-table-wrap", "展开逆向七模型调参结果", "收起逆向七模型调参结果");

  const reverseRole = Object.fromEntries(reverse.dataRoles.map((item) => [item["数据角色"], item]));
  const externalRole = reverseRole["MP–HydPARK 严格外部验证集"];
  const hydparkRole = reverseRole["HydPARK-only 实验母体"];
  $("#forward-feature-tip").innerHTML = `<b>最终入模 9 项</b><span>${esc(data.forward.featureEngineering.finalFeatureNames.join("、"))}</span>`;
  $("#reverse-feature-tip").innerHTML = `<b>最终全量重训 16 项</b><span>${esc(reverse.featureEngineering.finalFeatureNames.join("、"))}</span>`;
  $("#workflow-data-roles").innerHTML = [
    { type: "理论氢化物", count: data.forward.featureEngineering.cleanRows, label: "MP / DFT", text: "正向流程的训练对象与形成能标签；氢化物状态直接进入建模。", detail: "筛选链：MP 原始缓存 911 条 → 显式含 H 且为 2–4 元体系 908 条 → 要求形成能、凸包能、晶系、带隙、密度、原子体积与总磁矩等核心字段完整；同化学式保留 energy above hull 更低者，最终 673 条。" },
    { type: "理论母体标签", count: reverse.summary.development_samples, label: "MP-derived", text: "由最大容量氢化物相回溯母体合金，作为逆向流程的理论建模池。" },
    { type: "实验外部证据", count: `${externalRole["样本数"]} + ${hydparkRole["样本数"]}`, label: "HydPARK / HyStor", text: "27 个重合母体用于严格外部验证，1357 个实验母体保留为独立容量清单。" },
  ].map((item) => `<article${item.detail ? ' class="has-hover-card" tabindex="0"' : ""}><span>${esc(item.label)}</span><strong>${esc(item.count)}</strong><h3>${esc(item.type)}${item.detail ? '<i aria-hidden="true">i</i>' : ""}</h3><p>${esc(item.text)}</p>${item.detail ? `<span class="hover-card" role="tooltip"><b>机器学习筛选依据</b><span>${esc(item.detail)}</span></span>` : ""}</article>`).join("");

  $("#energy-factor").textContent = `${data.forward.scoring.energyFactor}；${data.forward.scoring.window}`;
  $("#score-caveat").textContent = `${data.forward.scoring.caveat} ${data.reverse.scoring.role}`;

  const top15 = reverse.rankingDiagnostics.find((item) => item.topK === 15) || reverse.rankingDiagnostics[0];
  $("#closure-metrics").innerHTML = [
    { value: reverse.overlap.commonParents, unit: "个", label: "两条路线共同母体" },
    { value: `${(reverse.overlap.top15OverlapRate * 100).toFixed(0)}%`, unit: "", label: "Top15 重合率" },
    { value: top15.scoreSpearman.toFixed(3), unit: "", label: "逆向评分 Spearman" },
    { value: externalMaximum.maeWtPct.toFixed(3), unit: " wt.%", label: "外部实验最大容量 MAE" },
  ].map((item) => `<article><strong>${esc(item.value)}<small>${esc(item.unit)}</small></strong><span>${esc(item.label)}</span></article>`).join("");
  $("#external-boundary").innerHTML = `<strong>校准边界</strong><p>外部样本呈正相关（Pearson r = ${externalMaximum.pearson.toFixed(3)}），实验最大容量 MAE = ${externalMaximum.maeWtPct.toFixed(3)} wt.%、R² = ${externalMaximum.r2.toFixed(3)}。这说明模型已有一定实验区分能力，但 27 条样本仍不足以支撑跨体系的高精度绝对容量预测。</p>`;

  $("#forward-candidate-table").innerHTML = data.forward.topCandidates.map((item) => `
    <tr><td><b>${item.predRank}</b><small>理论 ${item.trueRank}</small></td><td>${formulaHtml(item.formula)}</td><td>${formulaHtml(item.parentAlloy)}</td><td>${item.trueFormationEnergy.toFixed(3)}</td><td>${item.predFormationEnergy.toFixed(3)}</td><td>${item.absEnergyError.toFixed(3)}</td><td>${(item.hydrogenMassFraction * 100).toFixed(2)}%</td><td>${item.trueScore.toFixed(3)}</td><td><strong>${item.predScore.toFixed(3)}</strong></td></tr>
  `).join("");
  $("#reverse-candidate-table").innerHTML = reverse.topCandidates.map((item) => `
    <tr><td><b>${item.predictedRank}</b><small>理论 ${item.trueRank}</small></td><td>${formulaHtml(item.parentAlloy)}</td><td>${formulaHtml(item.hydride)}</td><td>${(item.actualCapacity * 100).toFixed(2)}%</td><td>${(item.predictedCapacity * 100).toFixed(2)}%</td><td>${(item.absCapacityError * 100).toFixed(2)}%</td><td>${item.efactor.toFixed(3)}</td><td>${item.trueScore.toFixed(3)}</td><td><strong>${item.predictedScore.toFixed(3)}</strong></td></tr>
  `).join("");

  $("#shap-boundary").textContent = data.workflowInterpretation.boundary;
  $("#shap-insight-grid").innerHTML = [
    ["正向流程", data.workflowInterpretation.forward],
    ["逆向流程", data.workflowInterpretation.reverse],
  ].map(([label, block]) => `<article><div class="insight-label">${esc(label)}</div><p class="insight-scope">${esc(block.scope)}</p>${block.insights.map((item) => `<section><span>TOP ${item.rank}</span><h3>${esc(item.feature)}</h3><b>${esc(item.direction)}</b><p>${esc(item.meaning)}</p></section>`).join("")}</article>`).join("");

  $("#research-insights").innerHTML = data.researchInsights.map((item, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("");

  const imagePreview = $("#image-preview");
  const imagePreviewContent = $("#image-preview-content");
  let previewCloseTimer = null;
  let previewPinned = false;

  function showImagePreview(image, pinned = false) {
    clearTimeout(previewCloseTimer);
    previewPinned = pinned;
    imagePreviewContent.src = image.currentSrc || image.src;
    imagePreviewContent.alt = image.alt || "图表放大预览";
    imagePreview.classList.toggle("pinned", pinned);
    imagePreview.classList.add("active");
    imagePreview.setAttribute("aria-hidden", "false");
  }

  function hideImagePreview(immediate = false) {
    if (previewPinned && !immediate) return;
    clearTimeout(previewCloseTimer);
    const close = () => {
      previewPinned = false;
      imagePreview.classList.remove("active", "pinned");
      imagePreview.setAttribute("aria-hidden", "true");
    };
    if (immediate) close();
    else previewCloseTimer = setTimeout(close, 110);
  }

  const zoomableImages = $$("main figure img");
  zoomableImages.forEach((image) => {
    image.classList.add("zoomable-image");
    image.tabIndex = 0;
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      image.addEventListener("mouseenter", () => showImagePreview(image));
      image.addEventListener("mouseleave", () => hideImagePreview());
      image.addEventListener("focus", () => showImagePreview(image));
      image.addEventListener("blur", () => hideImagePreview());
    }
    image.addEventListener("click", () => showImagePreview(image, true));
  });
  imagePreview.addEventListener("click", () => hideImagePreview(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideImagePreview(true);
  });

  const axisInfo = {
    materialTags: { counts: data.literature.materialCounts, label: "材料体系" },
    outputTags: { counts: data.literature.outputCounts, label: "输出目标" },
    methodTags: { counts: data.literature.methodCounts, label: "方法范式" },
    sourceTags: { counts: data.literature.sourceCounts, label: "数据来源" },
  };

  function paperMatchesFilter(paper) {
    let categoryMatch = true;
    if (matrixFilter) {
      categoryMatch = paper.materialTags.includes(matrixFilter.material) && paper.outputTags.includes(matrixFilter.output);
    } else if (axisFilter) {
      categoryMatch = paper[axis].includes(axisFilter);
    }
    if (!categoryMatch || !searchQuery) return categoryMatch;

    const concepts = resolvedOutputConcepts(searchQuery);
    if (concepts.length) {
      return concepts.some((concept) => (paper.outputConcepts || []).includes(concept));
    }
    const searchable = [
      paper.titleZh, paper.titleEn, paper.material,
      ...paper.tasks.flatMap((task) => [task.task, task.objective, task.outputs]),
    ].map(normalizeSearch).join("|");
    return searchable.includes(normalizeSearch(searchQuery));
  }

  function cloudSize(count, max) {
    const ratio = max ? count / max : 0;
    if (ratio >= 0.75) return "size-4";
    if (ratio >= 0.5) return "size-3";
    if (ratio >= 0.25) return "size-2";
    return "size-1";
  }

  function renderCloud() {
    const counts = axisInfo[axis].counts;
    const max = Math.max(...counts.map((item) => item.count));
    $("#category-cloud").innerHTML = counts.map((item) => `
      <button class="cloud-button ${cloudSize(item.count, max)} ${axisFilter === item.label ? "active" : ""}" type="button" data-filter="${esc(item.label)}">
        <span>${esc(item.label)}</span><b>${item.count}</b>
      </button>
    `).join("");
    $("#class-note").textContent = data.literature.note;
    $$(".cloud-button").forEach((button) => button.addEventListener("click", () => {
      axisFilter = axisFilter === button.dataset.filter ? "" : button.dataset.filter;
      matrixFilter = null;
      visibleLimit = 12;
      renderCloud();
      renderMatrix();
      renderPapers();
    }));
  }

  function matrixCount(material, output) {
    return data.literature.papers.filter((paper) => paper.materialTags.includes(material) && paper.outputTags.includes(output)).length;
  }

  function renderMatrix() {
    const materials = data.literature.materialCounts.slice(0, 8).map((item) => item.label);
    const outputs = data.literature.outputCounts.slice(0, 8).map((item) => item.label);
    const head = `<tr><th>材料体系</th>${outputs.map((output) => `<th title="${esc(output)}">${esc(output)}</th>`).join("")}</tr>`;
    const body = materials.map((material) => `<tr><th>${esc(material)}</th>${outputs.map((output) => {
      const count = matrixCount(material, output);
      const active = matrixFilter && matrixFilter.material === material && matrixFilter.output === output;
      return `<td>${count ? `<button class="matrix-cell ${active ? "active" : ""}" type="button" data-material="${esc(material)}" data-output="${esc(output)}" aria-label="${esc(material)}与${esc(output)}：${count}篇">${count}</button>` : "<span>0</span>"}</td>`;
    }).join("")}</tr>`).join("");
    $("#relation-matrix").innerHTML = `<table class="relation-matrix"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    $$(".matrix-cell").forEach((button) => button.addEventListener("click", () => {
      const next = { material: button.dataset.material, output: button.dataset.output };
      matrixFilter = matrixFilter && matrixFilter.material === next.material && matrixFilter.output === next.output ? null : next;
      axisFilter = "";
      visibleLimit = 12;
      renderCloud();
      renderMatrix();
      renderPapers();
    }));
  }

  function taskHtml(task, index) {
    const focus = new Set(task.highlightedFields || []);
    const row = (label, value, field) => value ? `<dt class="${focus.has(field) ? "review-focus" : ""}">${esc(label)}${focus.has(field) ? " · 审阅重点" : ""}</dt><dd>${esc(value)}</dd>` : "";
    return `<dl class="task"><dt>子任务 ${index + 1}</dt><dd><strong>${esc(task.task || task.objective || "文中子任务")}</strong></dd>${row("数据来源", task.dataSource, "数据来源")}${row("数据量", task.dataSize, "数据量")}${row("输入特征", task.inputs, "输入特征/描述符")}${row("预测输出", task.outputs, "预测输出/目标变量")}${row("模型/算法", task.models, "模型/算法名称")}${row("特殊处理", task.special, "解释/优化/特殊处理方法")}${row("证据位置", task.evidence, "证据页码/位置")}${row("复核状态", task.review, "原文复核状态")}${row("不确定项", task.uncertainty, "不确定项说明")}</dl>`;
  }

  function paperHtml(paper) {
    const tags = [...new Set([...paper.materialTags, ...paper.outputTags, ...(paper.outputConcepts || []), ...paper.methodTags, ...paper.sourceTags])];
    return `<details class="paper"><summary><span class="paper-id">${paper.id}</span><div><h3>${esc(paper.titleZh)}</h3><div class="paper-meta"><span>${esc(paper.year)}</span><span>${esc(paper.material)}</span><span>${esc(paper.confidence)}</span></div></div><span class="task-count">${paper.tasks.length} 个子任务</span></summary><div class="paper-body"><div class="tag-row">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>${paper.tasks.map(taskHtml).join("")}</div></details>`;
  }

  function renderPapers() {
    const matches = data.literature.papers.filter(paperMatchesFilter);
    $("#paper-list").innerHTML = matches.slice(0, visibleLimit).map(paperHtml).join("");
    $("#paper-result-count").textContent = `${matches.length} 篇文献 / ${matches.reduce((sum, paper) => sum + paper.tasks.length, 0)} 个子任务`;
    $("#show-more").hidden = visibleLimit >= matches.length;
    const filter = $("#active-filter");
    const clear = $("#clear-filter");
    const activeParts = [];
    if (matrixFilter) activeParts.push(`${matrixFilter.material} × ${matrixFilter.output}`);
    else if (axisFilter) activeParts.push(`${axisInfo[axis].label}：${axisFilter}`);
    const concepts = resolvedOutputConcepts(searchQuery);
    if (searchQuery) activeParts.push(concepts.length ? `输出概念：${searchQuery} → ${concepts.join(" / ")}` : `字段检索：${searchQuery}`);
    const activeText = activeParts.join("；");
    filter.hidden = !activeText;
    filter.textContent = activeText;
    clear.hidden = !activeText;
    $("#search-concept-hint").textContent = !searchQuery
      ? "同义名称会归入统一输出概念后再匹配。"
      : concepts.length
        ? `已将“${searchQuery}”归一为：${concepts.join(" / ")}。`
        : "未命中预设同义名称，已在题名、任务和输出字段中检索。";
  }

  $$(".axis-tabs button").forEach((button) => button.addEventListener("click", () => {
    axis = button.dataset.axis;
    axisFilter = "";
    matrixFilter = null;
    visibleLimit = 12;
    $$(".axis-tabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderCloud();
    renderMatrix();
    renderPapers();
  }));

  $("#clear-filter").addEventListener("click", () => {
    axisFilter = "";
    matrixFilter = null;
    searchQuery = "";
    $("#paper-search").value = "";
    visibleLimit = 12;
    renderCloud();
    renderMatrix();
    renderPapers();
  });
  $("#paper-search").addEventListener("input", (event) => {
    searchQuery = event.currentTarget.value.trim();
    visibleLimit = 12;
    renderPapers();
  });
  $("#show-more").addEventListener("click", () => { visibleLimit += 12; renderPapers(); });

  const dynamic = data.dynamicResearch;
  const dynamicReferenceMap = new Map(dynamic.references.map((reference) => [reference.id, reference]));
  const dynamicGroupForReference = new Map();
  dynamic.evidenceGroups.forEach((group, groupIndex) => {
    group.referenceIds.forEach((referenceId) => dynamicGroupForReference.set(referenceId, groupIndex));
  });

  const citationChips = (referenceIds) => referenceIds.map((referenceId) => `
    <button class="citation-chip" type="button" data-dynamic-ref="${esc(referenceId)}" aria-label="查看参考文献 ${esc(referenceId)}">${esc(referenceId)}</button>
  `).join("");

  $("#dynamic-title").textContent = dynamic.title;
  $("#dynamic-lead").textContent = dynamic.lead;
  $("#dynamic-survey-note").textContent = dynamic.surveyNote;
  const dynamicMaxCount = Math.max(...dynamic.surveyCounts.map((item) => item.count));
  $("#dynamic-survey-counts").innerHTML = dynamic.surveyCounts.map((item) => `
    <div class="gap-bar ${esc(item.tone)}">
      <span>${esc(item.label)}</span><i style="--bar-width:${(item.count / dynamicMaxCount * 100).toFixed(1)}%"></i><b>${item.count}</b>
    </div>
  `).join("");

  $("#dynamic-framework-title").textContent = dynamic.framework.title;
  $("#dynamic-framework-text").textContent = dynamic.framework.text;
  $("#dynamic-framework-citations").innerHTML = `<span>框架来源</span>${citationChips(dynamic.framework.referenceIds)}`;
  $("#dynamic-reaction-path").innerHTML = dynamic.stages.map((stage) => `
    <article class="reaction-stage">
      <div class="stage-topline"><span class="stage-index">${esc(stage.index)}</span><em>${esc(stage.focus)}</em></div>
      <h4>${formulaHtml(stage.title)}</h4>
      <dl class="stage-layers">
        <div><dt>动态标签</dt><dd>${formulaHtml(stage.outputs)}</dd></div>
        <div><dt>可建模输入</dt><dd>${formulaHtml(stage.inputs)}</dd></div>
        <div><dt>机理校准</dt><dd>${formulaHtml(stage.mechanism)}</dd></div>
      </dl>
      <div class="stage-citations">${citationChips(stage.referenceIds)}</div>
    </article>
  `).join("");
  $("#dynamic-cross-stage").innerHTML = dynamic.crossStage.map((track) => `
    <article class="cross-stage-track">
      <div><span>${esc(track.label)}</span><strong>${formulaHtml(track.value)}</strong></div>
      <p>${formulaHtml(track.note)}</p>
      <div>${citationChips(track.referenceIds)}</div>
    </article>
  `).join("");

  $("#dynamic-evidence-tabs").innerHTML = dynamic.evidenceGroups.map((group, index) => `
    <button type="button" role="tab" data-evidence-index="${index}" aria-selected="${index === 0 ? "true" : "false"}">
      <span>0${index + 1}</span>${esc(group.label)}
    </button>
  `).join("");

  function renderDynamicEvidence(groupIndex, focusReferenceId = "") {
    const group = dynamic.evidenceGroups[groupIndex];
    $$("#dynamic-evidence-tabs button").forEach((button, index) => {
      const active = index === groupIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const references = group.referenceIds.map((referenceId) => dynamicReferenceMap.get(referenceId)).filter(Boolean);
    $("#dynamic-evidence-panel").innerHTML = `
      <div class="evidence-case-heading"><p class="kicker">Evidence-backed route</p><h3>${esc(group.title)}</h3><p>${esc(group.summary)}</p></div>
      <div class="source-records">
        ${references.map((reference, index) => {
          const focused = reference.id === focusReferenceId;
          return `<details class="source-record ${focused ? "reference-focus" : ""}" id="dynamic-ref-${esc(reference.id)}" ${focused || (!focusReferenceId && index === 0) ? "open" : ""}>
            <summary><span>${esc(reference.id)}</span><div><strong>${formulaHtml(reference.title)}</strong><small>${esc(reference.supports)}</small></div></summary>
            <div class="source-record-body">
              <p><b>原文定位</b>${esc(reference.evidence)}</p>
              <p><b>适用边界</b>${formulaHtml(reference.boundary)}</p>
              <a href="https://doi.org/${esc(reference.doi)}" target="_blank" rel="noreferrer">DOI: ${esc(reference.doi)}</a>
            </div>
          </details>`;
        }).join("")}
      </div>
    `;
  }

  $$("#dynamic-evidence-tabs button").forEach((button) => button.addEventListener("click", () => {
    renderDynamicEvidence(Number(button.dataset.evidenceIndex));
  }));

  $("#dynamic-pilot-title").textContent = dynamic.pilot.title;
  $("#dynamic-pilot-text").textContent = dynamic.pilot.text;
  $("#dynamic-pilot-route").innerHTML = dynamic.pilot.nodes.map((node, index) => `
    ${index ? '<i class="pilot-arrow" aria-hidden="true"></i>' : ""}
    <article><span>${esc(node.label)}</span><strong>${formulaHtml(node.value)}</strong></article>
  `).join("");
  $("#dynamic-pilot-calibration").innerHTML = `<b>中间量分级</b>${esc(dynamic.pilot.calibration)} ${citationChips(dynamic.pilot.calibrationReferenceIds)}`;
  $("#dynamic-pilot-leakage").innerHTML = `<b>变量角色</b>${formulaHtml(dynamic.pilot.leakage)} ${citationChips(dynamic.pilot.leakageReferenceIds)}`;
  $("#dynamic-pilot-validation").innerHTML = `<b>分路建模</b>${formulaHtml(dynamic.pilot.validation)} ${citationChips(dynamic.pilot.validationReferenceIds)}`;
  $("#dynamic-boundary").innerHTML = `<strong>证据边界</strong>${formulaHtml(dynamic.boundary)}`;

  $("#dynamic-direction").addEventListener("click", (event) => {
    const button = event.target.closest(".citation-chip");
    if (!button) return;
    const referenceId = button.dataset.dynamicRef;
    const groupIndex = dynamicGroupForReference.get(referenceId) ?? 0;
    renderDynamicEvidence(groupIndex, referenceId);
    $("#dynamic-evidence-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  renderDynamicEvidence(0);

  $("#data-status").textContent = data.dataFoundation.status;
  $("#data-boundary").textContent = data.dataFoundation.boundary;
  $("#source-grid").innerHTML = data.dataFoundation.sources.map((source) => `<article class="source"><b>${esc(source.name)}</b><p>${esc(source.role)}</p><span>${esc(source.summary)}</span></article>`).join("");
  $("#foundation-metrics").innerHTML = data.dataFoundation.metrics.map((metric) => `<article><strong>${esc(metric.value)}</strong><span>${esc(metric.label)}</span></article>`).join("");
  $("#database-comparison").innerHTML = data.dataFoundation.databaseComparison.map((source) => `
    <article>
      <div><span>${esc(source.name)}</span><strong>${source.hydrideFormulas.toLocaleString()}</strong><small>去重氢化物</small></div>
      <dl><dt>原始记录</dt><dd>${source.rawRecords.toLocaleString()}</dd><dt>氢化物结构</dt><dd>${source.hydrideStructures.toLocaleString()}</dd><dt>无 H 母体候选</dt><dd>${source.parentFormulas.toLocaleString()}</dd><dt>含稀土氢化物</dt><dd>${source.rareEarthHydrides.toLocaleString()}</dd><dt>含稀土母体候选</dt><dd>${source.rareEarthParents.toLocaleString()}</dd></dl>
    </article>
  `).join("");
  $("#foundation-summary-list").innerHTML = data.dataFoundation.summary.map((item) => `<li>${esc(item)}</li>`).join("");
  $("#reference-list").innerHTML = data.references.map((reference) => `<li>${esc(reference.title)}. <a href="https://doi.org/${esc(reference.doi)}" target="_blank" rel="noreferrer">DOI: ${esc(reference.doi)}</a></li>`).join("");

  renderCloud();
  renderMatrix();
  renderPapers();
})();
