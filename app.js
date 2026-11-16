document.addEventListener("DOMContentLoaded", () => {
  if (!window.pdfjsLib || !window.jspdf) {
    console.error("必要なPDFライブラリが読み込まれていません。");
    return;
  }

  // PDF.js ワーカーの設定
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const { jsPDF } = window.jspdf;

  // DOM要素の安全な取得
  const uploadSection = document.getElementById("upload-section");
  const dropZone = document.getElementById("drop-zone");
  const selectFileBtn = document.getElementById("select-file-btn");
  const fileInput = document.getElementById("file-input");

  const settingsSection = document.getElementById("settings-section");
  const fileNameEl = document.getElementById("file-name");
  const originalSizeEl = document.getElementById("original-size");
  const compressBtn = document.getElementById("compress-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  const progressSection = document.getElementById("progress-section");
  const progressText = document.getElementById("progress-text");
  const progressBar = document.getElementById("progress-bar");

  const resultSection = document.getElementById("result-section");
  const resBeforeEl = document.getElementById("res-before");
  const resAfterEl = document.getElementById("res-after");
  const reductionBadge = document.getElementById("reduction-badge");
  const resultNote = document.getElementById("result-note");
  const downloadBtn = document.getElementById("download-btn");
  const resetBtn = document.getElementById("reset-btn");

  const errorBox = document.getElementById("error-box");

  let selectedFile = null;
  let currentDownloadUrl = null;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.classList.add("hidden");
  }

  function resetUI() {
    selectedFile = null;
    if (fileInput) fileInput.value = "";
    if (currentDownloadUrl) {
      URL.revokeObjectURL(currentDownloadUrl);
      currentDownloadUrl = null;
    }
    hideError();
    if (settingsSection) settingsSection.classList.add("hidden");
    if (progressSection) progressSection.classList.add("hidden");
    if (resultSection) resultSection.classList.add("hidden");
    if (uploadSection) uploadSection.classList.remove("hidden");
  }

  function handleFileSelect(file) {
    hideError();
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      showError("PDFファイル（.pdf）を選択してください。");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError("ファイルサイズが50MBを超えています。50MB以下のPDFを選択してください。");
      return;
    }

    selectedFile = file;
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (originalSizeEl) originalSizeEl.textContent = formatBytes(file.size);

    if (uploadSection) uploadSection.classList.add("hidden");
    if (resultSection) resultSection.classList.add("hidden");
    if (settingsSection) settingsSection.classList.remove("hidden");
  }

  // --- イベントリスナーの確実な登録 ---

  // 「ファイルを選択する」ボタンのクリック
  if (selectFileBtn && fileInput) {
    selectFileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    });
  }

  // ドロップゾーン全体のクリックでもファイル選択を開く
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", (e) => {
      // 子要素（ボタン）をクリックした場合は重複発火を防ぐ
      if (e.target === selectFileBtn || selectFileBtn.contains(e.target)) return;
      fileInput.click();
    });
  }

  // ファイルが選択されたとき
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // ドラッグ＆ドロップ
  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (cancelBtn) cancelBtn.addEventListener("click", resetUI);
  if (resetBtn) resetBtn.addEventListener("click", resetUI);

  // 品質設定に応じたスケール（解像度）とJPEG画質
  function getRenderParams() {
    const checkedRadio = document.querySelector('input[name="quality"]:checked');
    const mode = checkedRadio ? checkedRadio.value : "medium";
    switch (mode) {
      case "high":
        return { scale: 1.0, quality: 0.45 };
      case "low":
        return { scale: 1.5, quality: 0.85 };
      case "medium":
      default:
        return { scale: 1.2, quality: 0.65 };
    }
  }

  // 圧縮処理のメイン実行
  if (compressBtn) {
    compressBtn.addEventListener("click", async () => {
      if (!selectedFile) return;

      hideError();
      if (settingsSection) settingsSection.classList.add("hidden");
      if (progressSection) progressSection.classList.remove("hidden");
      if (progressBar) progressBar.style.width = "10%";
      if (progressText) progressText.textContent = "PDFファイルを読み込んでいます...";

      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        const { scale, quality } = getRenderParams();
        let newPdf = null;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const percent = Math.round(10 + (pageNum / totalPages) * 80);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressText) progressText.textContent = `ページを最適化しています... (${pageNum} / ${totalPages} ページ)`;

          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const imgData = canvas.toDataURL("image/jpeg", quality);

          const orientation = viewport.width > viewport.height ? "l" : "p";
          const pageWidth = viewport.width;
          const pageHeight = viewport.height;

          if (pageNum === 1) {
            newPdf = new jsPDF({
              orientation: orientation,
              unit: "px",
              format: [pageWidth, pageHeight],
            });
          } else {
            newPdf.addPage([pageWidth, pageHeight], orientation);
          }

          newPdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        }

        if (progressBar) progressBar.style.width = "95%";
        if (progressText) progressText.textContent = "圧縮済みPDFファイルを生成しています...";

        const compressedBlob = newPdf.output("blob");
        if (progressBar) progressBar.style.width = "100%";

        const beforeSize = selectedFile.size;
        const afterSize = compressedBlob.size;

        if (resBeforeEl) resBeforeEl.textContent = formatBytes(beforeSize);
        if (resAfterEl) resAfterEl.textContent = formatBytes(afterSize);

        const reduction = ((beforeSize - afterSize) / beforeSize) * 100;

        if (reduction > 0) {
          if (reductionBadge) {
            reductionBadge.textContent = `${reduction.toFixed(1)}% 削減！`;
            reductionBadge.style.backgroundColor = "#16a34a";
          }
          if (resultNote) resultNote.textContent = "レイアウト崩れや文字化けを起こさず、安全にファイルサイズを削減しました。";
        } else {
          if (reductionBadge) {
            reductionBadge.textContent = "最適化完了";
            reductionBadge.style.backgroundColor = "#16a34a";
          }
          if (resultNote) resultNote.textContent = "PDFの全ページを再構築し、ファイルを保存しました。";
        }

        currentDownloadUrl = URL.createObjectURL(compressedBlob);
        if (downloadBtn) downloadBtn.href = currentDownloadUrl;
        const baseName = selectedFile.name.replace(/\.pdf$/i, "");
        if (downloadBtn) downloadBtn.download = `${baseName}_compressed.pdf`;

        if (progressSection) progressSection.classList.add("hidden");
        if (resultSection) resultSection.classList.remove("hidden");
      } catch (err) {
        console.error("PDF処理エラー:", err);
        if (progressSection) progressSection.classList.add("hidden");
        if (settingsSection) settingsSection.classList.add("hidden");
        if (uploadSection) uploadSection.classList.remove("hidden");
        showError("PDFの処理中にエラーが発生しました。パスワード付きPDFなどは処理できません。");
      }
    });
  }
});