(() => {
  const form = document.querySelector("[data-scottpdf-tool]");
  if (!form) return;

  // ---------------------------------------------------------------
  // File thumbnails — real PDF page-1 renders (via pdf.js, loaded on
  // demand from cdnjs) and real image previews, so the file list shows
  // what you actually picked instead of just a filename. Results are
  // cached per File object so reordering/removing files in the list
  // (which rebuilds the whole <ul>) never re-renders a thumbnail twice.
  // ---------------------------------------------------------------
  const thumbCache = new WeakMap();
  let pdfjsLoadPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsLoadPromise) return pdfjsLoadPromise;
    pdfjsLoadPromise = new Promise((resolve, reject) => {
      // The legacy UMD build (last shipped in the 3.x line) attaches a
      // plain `window.pdfjsLib` global — no ESM/module wiring needed,
      // which keeps this working across older mobile browsers too.
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        if (!window.pdfjsLib) return reject(new Error("pdf.js failed to initialize"));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("pdf.js failed to load"));
      document.head.append(script);
    });
    return pdfjsLoadPromise;
  }

  function extLabel(name) {
    const ext = (name.split(".").pop() || "").toUpperCase();
    return ext.length > 4 ? ext.slice(0, 4) : ext || "FILE";
  }

  function appendImg(wrap, src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    wrap.replaceChildren(img);
  }

  function appendIcon(wrap, text, extraClass) {
    const icon = document.createElement("span");
    icon.className = "file-thumb-icon" + (extraClass ? ` ${extraClass}` : "");
    icon.textContent = text;
    wrap.replaceChildren(icon);
  }

  async function renderPdfThumb(file, wrap) {
    try {
      const pdfjsLib = await loadPdfJs();
      const buffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdfDoc.getPage(1);
      const targetWidth = 88;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      thumbCache.set(file, dataUrl);
      if (wrap.isConnected) appendImg(wrap, dataUrl);
    } catch (error) {
      thumbCache.set(file, "error");
    }
  }

  function makeThumb(file) {
    const wrap = document.createElement("span");
    wrap.className = "file-thumb";
    const cached = thumbCache.get(file);
    if (typeof cached === "string" && cached !== "error") {
      appendImg(wrap, cached);
      return wrap;
    }
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isImage) {
      const url = URL.createObjectURL(file);
      thumbCache.set(file, url);
      appendImg(wrap, url);
      return wrap;
    }
    if (isPdf) {
      appendIcon(wrap, "PDF", "file-thumb-pdf");
      if (cached !== "error") renderPdfThumb(file, wrap);
      return wrap;
    }
    const ext = extLabel(file.name).toLowerCase();
    appendIcon(wrap, extLabel(file.name), `ext-${ext}`);
    return wrap;
  }

  function revokeThumb(file) {
    const cached = thumbCache.get(file);
    if (typeof cached === "string" && cached.startsWith("blob:")) URL.revokeObjectURL(cached);
  }

  const definitions = {
    merge: { title: "Merge PDF", description: "Combine PDFs in the order you choose.", accept: ".pdf,application/pdf", multiple: true, count: "Select at least two PDF files. Drag rows to change their order.", fields: [] },
    split: { title: "Split PDF", description: "Separate pages or page ranges into new PDFs.", accept: ".pdf,application/pdf", fields: [{name:"pages",label:"Page ranges",placeholder:"1-3, 5, 8-9",help:"Leave blank to save each page as a separate PDF in a ZIP."}] },
    compress: { title: "Compress PDF", description: "Reduce file size with structural cleanup and image optimization.", accept: ".pdf,application/pdf", fields: [{name:"level",label:"Compression level",type:"select",options:[["recommended","Recommended — balanced size and quality"],["extreme","Extreme — smaller file, lower image quality"],["less","Less compression — higher image quality"]]}] },
    jpg_to_pdf: { title: "JPG to PDF", description: "Turn images into a single PDF document.", accept: ".jpg,.jpeg,.png,.webp,.bmp,image/*", multiple: true, fields: [{name:"orientation",label:"Page orientation",type:"select",options:[["auto","Match image orientation"],["portrait","Portrait"],["landscape","Landscape"]]}] },
    word_to_pdf: { title: "Word to PDF", description: "Convert a DOCX document into a PDF.", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", fields: [] },
    powerpoint_to_pdf: { title: "PowerPoint to PDF", description: "Convert a PPTX presentation into a PDF.", accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation", fields: [] },
    excel_to_pdf: { title: "Excel to PDF", description: "Convert an XLSX workbook into a PDF.", accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fields: [] },
    html_to_pdf: { title: "HTML to PDF", description: "Create a PDF from an HTML file or a public web address.", accept: ".html,.htm,text/html", fields: [{name:"url",label:"Web address",placeholder:"https://example.com",help:"Or choose an HTML file above. Public websites only."}] },
    pdf_to_jpg: { title: "PDF to JPG", description: "Render each PDF page as an image.", accept: ".pdf,application/pdf", fields: [{name:"format",label:"Image format",type:"select",options:[["jpg","JPG"],["png","PNG"]]}] },
    pdf_to_word: { title: "PDF to Word", description: "Extract PDF text into an editable DOCX file.", accept: ".pdf,application/pdf", fields: [] },
    pdf_to_powerpoint: { title: "PDF to PowerPoint", description: "Create one PowerPoint slide per PDF page.", accept: ".pdf,application/pdf", fields: [] },
    pdf_to_excel: { title: "PDF to Excel", description: "Extract PDF text into an XLSX workbook, organized by page.", accept: ".pdf,application/pdf", fields: [] },
    convert_pdf_to_pdfa: { title: "PDF to PDF/A", description: "PDF/A conversion is unavailable until an archival conversion and validation engine is installed on the server.", accept: ".pdf,application/pdf", fields: [], unavailable: true },
    remove_pages: { title: "Remove pages", description: "Remove selected pages from a PDF.", accept: ".pdf,application/pdf", fields: [{name:"pages",label:"Pages to remove",placeholder:"2, 5-7",required:true}] },
    extract: { title: "Extract pages", description: "Save selected pages as a new PDF.", accept: ".pdf,application/pdf", fields: [{name:"pages",label:"Pages to extract",placeholder:"1, 5-8",help:"Leave blank to extract every page."}] },
    organize_pdf: { title: "Organize PDF", description: "Reorder all PDF pages.", accept: ".pdf,application/pdf", fields: [{name:"order",label:"New page order",placeholder:"3, 1, 2",required:true,help:"Enter every page number once, in the order you want."}] },
    scan_pdf: { title: "Scan to PDF", description: "Combine photos or scans into a PDF.", accept: ".jpg,.jpeg,.png,.webp,.bmp,image/*", multiple: true, camera: true, fields: [] },
    repair_pdf: { title: "Repair PDF", description: "Rebuild the PDF structure and recover readable pages.", accept: ".pdf,application/pdf", fields: [] },
    ocr_pdf: { title: "OCR PDF", description: "Make scanned PDF pages searchable with optical character recognition.", accept: ".pdf,application/pdf", fields: [{name:"language",label:"Document language",type:"select",options:[["eng","English"],["eng+fra","English and French"],["eng+spa","English and Spanish"],["deu","German"],["fra","French"],["spa","Spanish"],["ara","Arabic"],["hin","Hindi"],["jpn","Japanese"],["chi_sim","Chinese (Simplified)"]]}] },
    rotate_pdf: { title: "Rotate PDF", description: "Rotate all pages or selected pages.", accept: ".pdf,application/pdf", fields: [{name:"angle",label:"Rotation",type:"select",options:[["90","90° clockwise"],["180","180°"],["270","270° clockwise"]]},{name:"pages",label:"Pages",placeholder:"Leave blank for all pages"}] },
    add_pdf_page_number: { title: "Add page numbers", description: "Stamp page numbers onto your PDF.", accept: ".pdf,application/pdf", fields: [{name:"start_number",label:"First number",type:"number",value:"1"},{name:"position",label:"Position",type:"select",options:[["bottom-center","Bottom center"],["bottom-right","Bottom right"],["top-center","Top center"]]}] },
    pdf_add_watermark: { title: "Add watermark", description: "Stamp translucent text over each PDF page.", accept: ".pdf,application/pdf", fields: [{name:"text",label:"Watermark text",placeholder:"CONFIDENTIAL",required:true},{name:"opacity",label:"Opacity",type:"select",options:[["0.15","Light"],["0.25","Medium"],["0.5","Strong"]]}] },
    crop_pdf: { title: "Crop PDF", description: "Trim page margins by percentage.", accept: ".pdf,application/pdf", fields: [{name:"top",label:"Top margin (%)",type:"number",value:"0"},{name:"right",label:"Right margin (%)",type:"number",value:"0"},{name:"bottom",label:"Bottom margin (%)",type:"number",value:"0"},{name:"left",label:"Left margin (%)",type:"number",value:"0"}] },
    edit_pdf: { title: "Edit PDF", description: "Add a text note to a PDF page.", accept: ".pdf,application/pdf", fields: [{name:"text",label:"Text to add",placeholder:"Enter text",required:true},{name:"page",label:"Page number",type:"number",value:"1"},{name:"x",label:"Horizontal position (points)",type:"number",value:"72"},{name:"y",label:"Vertical position (points)",type:"number",value:"360"}] },
    pdf_forms: { title: "PDF Forms", description: "Fill existing interactive form fields in a PDF.", accept: ".pdf,application/pdf", fields: [{name:"fields",label:"Field values (JSON)",type:"textarea",value:"{}",help:"Use the exact field names and values, for example {\"Name\":\"Scott\"}."}] },
    unlock_pdf: { title: "Unlock PDF", description: "Remove password protection from a PDF you are allowed to access.", accept: ".pdf,application/pdf", fields: [{name:"password",label:"Current PDF password",type:"password",required:true}] },
    protect_pdf: { title: "Protect PDF", description: "Encrypt a PDF with a password.", accept: ".pdf,application/pdf", fields: [{name:"password",label:"New password",type:"password",required:true}] },
    sign_pdf: { title: "Sign PDF", description: "Place a typed signature on a PDF page.", accept: ".pdf,application/pdf", fields: [{name:"text",label:"Signature text",placeholder:"Your name",required:true},{name:"page",label:"Page number",type:"number",value:"1"},{name:"x",label:"Horizontal position (points)",type:"number",value:"72"},{name:"y",label:"Vertical position (points)",type:"number",value:"360"}] },
    redact_pdf: { title: "Redact PDF", description: "Permanently remove matching text from a PDF.", accept: ".pdf,application/pdf", fields: [{name:"terms",label:"Text to redact",type:"textarea",placeholder:"One word or phrase per line",required:true,help:"Redactions remove matching text and cover it with black boxes."}] },
    compare_pdf: { title: "Compare PDF", description: "Compare text from two PDF versions and download a difference report.", accept: ".pdf,application/pdf", multiple: true, fields: [] },
    pdf_summarize: { title: "AI Summarizer", description: "Create a concise summary from the text in a PDF.", accept: ".pdf,application/pdf", fields: [{name:"length",label:"Summary length",type:"select",options:[["short","Short"],["medium","Medium"],["long","Long"]]}] },
    translate_pdf: { title: "Translate PDF", description: "Translate extracted PDF text using the configured AI service.", accept: ".pdf,application/pdf", fields: [{name:"target_language",label:"Translate to",placeholder:"English",required:true}] },
    pdf_to_markdown: { title: "PDF to Markdown", description: "Extract PDF text into a Markdown file, separated by page.", accept: ".pdf,application/pdf", fields: [] },
  };

  const tool = form.dataset.scottpdfTool;
  const config = definitions[tool];
  if (!config) return;
  document.title = `${config.title} | ScottPDF`;
  document.querySelector("h1[data-title]").textContent = config.title;
  document.querySelector("[data-description]").textContent = config.description;
  const picker = form.querySelector("input[type=file]");
  const pickerLabel = form.querySelector("[data-picker-label]");
  const list = form.querySelector("[data-file-list]");
  const status = form.querySelector("[data-status]");
  const submit = form.querySelector("button[type=submit]");
  const drop = form.querySelector("[data-drop-zone]");
  const result = form.querySelector("[data-result]");
  const optionsHost = form.querySelector("[data-options]");
  const actions = form.querySelector(".actions");
  let selected = [];

  picker.accept = config.accept;
  picker.multiple = Boolean(config.multiple);
  if (config.camera) picker.setAttribute("capture", "environment");
  const labels = { jpg_to_pdf: "Select image files", scan_pdf: "Select images", word_to_pdf: "Select Word file", powerpoint_to_pdf: "Select presentation", excel_to_pdf: "Select spreadsheet", html_to_pdf: "Select HTML file" };
  pickerLabel.textContent = labels[tool] || (config.multiple ? "Select PDF files" : "Select PDF file");
  form.querySelector("[data-file-help]").textContent = config.count || (config.multiple ? "You can add multiple files." : "One file per task.");
  if (config.unavailable) {
    const notice = document.createElement("p");
    notice.className = "status";
    notice.setAttribute("role", "note");
    notice.textContent = config.description;
    optionsHost.append(notice);
  }
  config.fields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = `option-${field.name}`;
    label.textContent = field.label;
    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      field.options.forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        control.append(option);
      });
    } else if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 4;
      if (field.placeholder) control.placeholder = field.placeholder;
    } else {
      control = document.createElement("input");
      control.type = field.type || "text";
      if (field.placeholder) control.placeholder = field.placeholder;
    }
    control.id = `option-${field.name}`;
    control.name = field.name;
    control.required = Boolean(field.required);
    if (field.value !== undefined) control.value = field.value;
    if (field.help) {
      const help = document.createElement("p");
      help.className = "hint";
      help.textContent = field.help;
      optionsHost.append(label, control, help);
    } else optionsHost.append(label, control);
  });

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("error", isError);
    status.hidden = !message;
  };

  const renderFiles = () => {
    list.replaceChildren();
    selected.forEach((file, index) => {
      const item = document.createElement("li");
      const thumb = makeThumb(file);
      const label = document.createElement("span");
      const actions = document.createElement("span");
      label.className = "file-name";
      label.textContent = `${index + 1}. ${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      if (tool === "merge") {
        for (const [text, delta] of [["↑", -1], ["↓", 1]]) {
          const move = document.createElement("button");
          move.type = "button";
          move.className = "file-remove reorder";
          move.textContent = text;
          move.setAttribute("aria-label", `${text === "↑" ? "Move up" : "Move down"} ${file.name}`);
          move.disabled = index + delta < 0 || index + delta >= selected.length;
          move.addEventListener("click", () => {
            const next = index + delta;
            [selected[index], selected[next]] = [selected[next], selected[index]];
            renderFiles();
          });
          actions.append(move);
        }
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => { revokeThumb(file); selected.splice(index, 1); renderFiles(); });
      actions.append(remove);
      item.append(thumb, label, actions);
      list.append(item);
    });
    list.hidden = selected.length === 0;
    drop.hidden = selected.length > 0 && !config.multiple;
    optionsHost.hidden = !config.unavailable && selected.length === 0 && tool !== "html_to_pdf";
    const canProcess = selected.length > 0 || (tool === "html_to_pdf" && Boolean(form.querySelector("[name=url]")?.value.trim()));
    actions.hidden = config.unavailable || !canProcess;
    submit.textContent = config.title;
    submit.disabled = Boolean(config.unavailable) || (selected.length === 0 && !(tool === "html_to_pdf" && form.querySelector("[name=url]")?.value.trim()));
  };

  const addFiles = (files) => {
    showStatus("");
    const incoming = Array.from(files || []);
    const combined = config.multiple ? [...selected, ...incoming] : incoming.slice(0, 1);
    if (combined.length > 20) return showStatus("Choose no more than 20 files.", true);
    if (combined.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) return showStatus("The total upload must be 100 MB or smaller.", true);
    if (!config.multiple) selected.forEach((file) => { if (!combined.includes(file)) revokeThumb(file); });
    selected = combined;
    renderFiles();
  };

  picker.addEventListener("change", (event) => { addFiles(event.target.files); picker.value = ""; });
  ["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
  form.addEventListener("input", renderFiles);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const urlValue = form.querySelector("[name=url]")?.value.trim();
    if (!selected.length && !(tool === "html_to_pdf" && urlValue)) return;
    if (tool === "merge" && selected.length < 2) return showStatus("Choose at least two PDFs to merge.", true);
    if (tool === "compare_pdf" && selected.length !== 2) return showStatus("Choose exactly two PDFs to compare.", true);
    const body = new FormData();
    selected.forEach((file) => body.append("files", file, file.name));
    const values = {};
    for (const field of config.fields) {
      const control = form.elements.namedItem(field.name);
      if (control && control.value !== "") values[field.name] = control.value;
    }
    const outputName = form.elements.namedItem("output_name");
    if (outputName?.value.trim()) values.output_name = outputName.value.trim();
    if (tool === "pdf_summarize" && values.length) values.target_words = values.length === "short" ? "90" : values.length === "long" ? "300" : "180";
    body.append("options", JSON.stringify(values));
    submit.disabled = true;
    submit.textContent = "Processing…";
    result.hidden = true;
    showStatus("Processing your file on ScottPDF…");
    try {
      const response = await fetch(`/api/v1/process/${tool}`, { method: "POST", body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "The file could not be processed.");
      }
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition") || "";
      const match = header.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
      const filename = match ? decodeURIComponent(match[1].replace(/\"/g, "")) : `scottpdf-${tool}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = result.querySelector("a");
      link.href = url;
      link.download = filename;
      link.textContent = `Download ${filename}`;
      result.hidden = false;
      const isText = blob.type.startsWith("text/");
      const preview = result.querySelector("pre");
      preview.hidden = !isText;
      if (isText) preview.textContent = (await blob.text()).slice(0, 20000);
      showStatus("Your file is ready.");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showStatus(error.message || "The request failed. Please try again.", true);
    } finally {
      const canProcess = selected.length > 0 || (tool === "html_to_pdf" && Boolean(form.querySelector("[name=url]")?.value.trim()));
      actions.hidden = config.unavailable || !canProcess;
      submit.disabled = Boolean(config.unavailable) || !canProcess;
      submit.textContent = config.title;
    }
  });

  renderFiles();
})();
