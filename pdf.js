import {
  state,
  uiState,
  elements,
  formatCurrency,
  reportingCurrency,
  normalizeCurrencyCode,
  getPaymentMethodById,
  defaultPaymentMethods,
  computedStatus,
  getClient,
} from './state.js';
import {
  resolveInvoiceIssuerName,
  escapeHtml,
  getInvoiceSenderDetails,
} from './profile.js';

export function getInvoiceDocumentLabel(invoice) {
  return computedStatus(invoice) === 'paid' ? 'Receipt' : 'Invoice';
}

function paymentMethodsForInvoice(invoice, client) {
  const directMethod = getPaymentMethodById(invoice.paymentMethodId);
  if (directMethod) return [directMethod];

  const clientMethod = getPaymentMethodById(client?.preferredPaymentMethodId);
  if (clientMethod) return [clientMethod];

  return defaultPaymentMethods();
}

export function buildInvoicePreviewMarkup(invoice) {
  const documentLabel = getInvoiceDocumentLabel(invoice);
  const defaultCurrency = normalizeCurrencyCode(invoice.defaultCurrency || reportingCurrency());
  const clientCurrency = normalizeCurrencyCode(invoice.clientCurrency || defaultCurrency);
  const hasClientCurrencyTotal = clientCurrency !== defaultCurrency && Number(invoice.clientCurrencyTotal || 0) > 0;
  const money = (value) => formatCurrency(value, defaultCurrency);
  const {
    client,
    primarySenderName,
    secondarySenderName,
    senderAddress,
    senderEmail,
    senderWebsite,
    senderPhone,
    senderVatNumber,
    senderLogoDataUrl,
  } = getInvoiceSenderDetails(invoice);
  const paymentMethods = paymentMethodsForInvoice(invoice, client);

  const senderLines = [
    primarySenderName ? `<p class="preview-primary-name">${escapeHtml(primarySenderName)}</p>` : '',
    secondarySenderName ? `<p class="preview-secondary-name">${escapeHtml(secondarySenderName)}</p>` : '',
    senderAddress ? `<p>${escapeHtml(senderAddress)}</p>` : '',
    senderEmail ? `<p>Email: ${escapeHtml(senderEmail)}</p>` : '',
    senderWebsite ? `<p>Website: ${escapeHtml(senderWebsite)}</p>` : '',
    senderPhone ? `<p>Phone: ${escapeHtml(senderPhone)}</p>` : '',
    senderVatNumber ? `<p>VAT/Tax ID: ${escapeHtml(senderVatNumber)}</p>` : '',
  ].filter(Boolean).join('');

  const clientLines = [
    client?.name ? `<p class="preview-primary-name">${escapeHtml(client.name)}</p>` : '',
    client?.address ? `<p>${escapeHtml(client.address)}</p>` : '',
    client?.vatNumber ? `<p>VAT/Tax ID: ${escapeHtml(client.vatNumber)}</p>` : '',
    `<p>Client ID: ${escapeHtml(client?.displayId || '')}</p>`,
  ].filter(Boolean).join('');

  const paymentHtml = paymentMethods.length
    ? `
    <div class="preview-party-card">
      <strong>Payment details</strong>
      ${paymentMethods.map((method) => `
        <p class="preview-primary-name">${escapeHtml(method.type ? `${method.label} (${method.type})` : method.label)}</p>
        ${method.details ? `<p>${escapeHtml(method.details)}</p>` : ''}
      `).join('')}
    </div>
  `
    : '';

  return `
    <div class="preview-header">
      <div>
        <h1 style="margin:0;">${escapeHtml(documentLabel)}</h1>
        <p style="margin:8px 0 0; color: var(--muted);">${escapeHtml(invoice.invoiceNumber)}</p>
        ${senderLogoDataUrl ? `<img class="preview-logo" src="${escapeHtml(senderLogoDataUrl)}" alt="${escapeHtml(primarySenderName || 'Business')} logo">` : ''}
      </div>
      <div class="preview-meta">
        <div><strong style="color: var(--text);">Issue date:</strong> ${escapeHtml(invoice.issueDate || '')}</div>
        <div><strong style="color: var(--text);">Due date:</strong> ${escapeHtml(invoice.dueDate || '')}</div>
        <div><strong style="color: var(--text);">Status:</strong> ${escapeHtml(computedStatus(invoice))}</div>
      </div>
    </div>
    <div class="preview-party-grid">
      <div class="preview-party-card">
        <strong>From</strong>
        ${senderLines || '<p>Sender details missing.</p>'}
      </div>
      <div class="preview-party-card">
        <strong>Client</strong>
        ${clientLines}
      </div>
      ${paymentHtml}
    </div>
    <table class="preview-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Net</th>
          <th>VAT</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(invoice.description || '')}</td>
          <td>${escapeHtml(money(invoice.subtotal))}</td>
          <td>${escapeHtml(`${Number(invoice.vatRate || 0)}% (${money(invoice.vatAmount)})`)}</td>
          <td>${escapeHtml(money(invoice.total))}</td>
        </tr>
      </tbody>
    </table>
    <div class="preview-totals">
      <div class="preview-total-row"><span>Subtotal (${escapeHtml(defaultCurrency)})</span><strong>${escapeHtml(money(invoice.subtotal))}</strong></div>
      <div class="preview-total-row"><span>VAT (${escapeHtml(defaultCurrency)})</span><strong>${escapeHtml(money(invoice.vatAmount))}</strong></div>
      <div class="preview-total-row"><span>Total (${escapeHtml(defaultCurrency)})</span><strong>${escapeHtml(money(invoice.total))}</strong></div>
      ${hasClientCurrencyTotal ? `<div class="preview-total-row"><span>Total (${escapeHtml(clientCurrency)})</span><strong>${escapeHtml(formatCurrency(invoice.clientCurrencyTotal, clientCurrency))}</strong></div>` : ''}
    </div>
  `;
}

export function openInvoicePreview(invoice) {
  const documentLabel = getInvoiceDocumentLabel(invoice);
  uiState.pendingPreviewInvoiceId = invoice.id;
  elements.invoicePreviewEyebrow.textContent = `${documentLabel} review`;
  elements.invoicePreviewTitle.textContent = `Preview ${documentLabel.toLowerCase()}`;
  elements.invoicePreviewContent.innerHTML = buildInvoicePreviewMarkup(invoice);
  elements.invoicePreviewModal.hidden = false;
  elements.invoicePreviewDownloadBtn.focus();
}

export function closeInvoicePreview() {
  uiState.pendingPreviewInvoiceId = '';
  elements.invoicePreviewEyebrow.textContent = 'Invoice review';
  elements.invoicePreviewTitle.textContent = 'Preview invoice';
  elements.invoicePreviewContent.innerHTML = '';
  elements.invoicePreviewModal.hidden = true;
}

export function buildReminder(invoice, tone) {
  const client = getClient(invoice.clientId);
  const paymentMethods = paymentMethodsForInvoice(invoice, client);
  const name = client?.contactName || client?.name || 'there';
  const defaultCurrency = normalizeCurrencyCode(invoice.defaultCurrency || reportingCurrency());
  const money = (value) => formatCurrency(value, defaultCurrency);

  if (tone === 'polite') {
    return `Subject: Friendly reminder for ${invoice.invoiceNumber}

Hi ${name},

I hope you're well. Just a quick reminder that invoice ${invoice.invoiceNumber} for ${money(invoice.total)} was due on ${invoice.dueDate}.

Please let me know if payment is already in progress.

Thanks very much.`;
  }

  if (tone === 'firm') {
    return `Subject: Overdue invoice ${invoice.invoiceNumber}

Hi ${name},

This is a reminder that invoice ${invoice.invoiceNumber} for ${money(invoice.total)} is overdue since ${invoice.dueDate}.

Please confirm payment status and arrange settlement as soon as possible.

Thank you.`;
  }

  return `Subject: Reminder for ${invoice.invoiceNumber}

Hi ${name},

Just a reminder that invoice ${invoice.invoiceNumber} for ${money(invoice.total)} was due on ${invoice.dueDate}.

Please let me know if payment has already been scheduled.

Best regards.`;
}

export function printInvoice(invoice) {
  const documentLabel = getInvoiceDocumentLabel(invoice);
  const defaultCurrency = normalizeCurrencyCode(invoice.defaultCurrency || reportingCurrency());
  const clientCurrency = normalizeCurrencyCode(invoice.clientCurrency || defaultCurrency);
  const hasClientCurrencyTotal = clientCurrency !== defaultCurrency && Number(invoice.clientCurrencyTotal || 0) > 0;
  const money = (value) => formatCurrency(value, defaultCurrency);
  const client = getClient(invoice.clientId);
  const paymentMethods = paymentMethodsForInvoice(invoice, client);
  const senderName = resolveInvoiceIssuerName(invoice);
  const senderBusiness = invoice.issuerType === 'business' && invoice.issuerBusinessId
    ? state.profile.businesses.find((item) => item.id === invoice.issuerBusinessId)
    : null;
  const senderLegalName = String(state.profile.legalName || state.profile.personalName || '').trim();
  const secondarySenderName = Boolean(
    senderBusiness
    && senderName
    && senderName.toLowerCase() !== String(senderLegalName || '').toLowerCase()
  ) ? senderName : '';
  const primarySenderName = senderLegalName || senderName || '';
  const senderAddress = state.profile.address || '';
  const senderEmail = senderBusiness?.contactEmail || state.profile.email || '';
  const senderWebsite = senderBusiness?.website || '';
  const senderPhone = state.profile.phone || '';
  const senderVatNumber = state.profile.vatNumber || '';
  const senderLogoDataUrl = senderBusiness?.logoDataUrl || '';
  const jsPdfApi = window.jspdf?.jsPDF;
  if (!jsPdfApi) {
    alert('PDF generation is unavailable right now. Reload the page and try again.');
    return;
  }

  const pdf = new jsPdfApi({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const columnGap = 28;
  const columnWidth = (contentWidth - columnGap) / 2;

  const sanitize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const drawLabel = (text, x, y) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(text, x, y);
  };
  const drawValue = (text, x, y, options = {}) => {
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(options.size || 11);
    pdf.setTextColor(17, 24, 39);
    const lines = pdf.splitTextToSize(sanitize(text), options.maxWidth || columnWidth);
    pdf.text(lines, x, y);
    return lines.length;
  };
  const drawMuted = (text, x, y, options = {}) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(options.size || 10);
    pdf.setTextColor(107, 114, 128);
    const lines = pdf.splitTextToSize(sanitize(text), options.maxWidth || columnWidth);
    pdf.text(lines, x, y);
    return lines.length;
  };

  let cursorY = margin;

  if (senderLogoDataUrl) {
    try {
      const logoFormat = senderLogoDataUrl.includes('image/jpeg') || senderLogoDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      pdf.addImage(senderLogoDataUrl, logoFormat, margin, cursorY, 92, 56, undefined, 'FAST');
    } catch {
      // Ignore logo rendering failures and continue with the PDF download.
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(15, 23, 42);
  pdf.text(documentLabel, margin, cursorY + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(107, 114, 128);
  pdf.text(sanitize(invoice.invoiceNumber || 'Invoice'), margin, cursorY + 38);

  const metaX = pageWidth - margin - 170;
  drawLabel('Issue date', metaX, cursorY + 8);
  drawValue(invoice.issueDate || '', metaX, cursorY + 24, { maxWidth: 170 });
  drawLabel('Due date', metaX, cursorY + 48);
  drawValue(invoice.dueDate || '', metaX, cursorY + 64, { maxWidth: 170 });

  cursorY += 92;

  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 26;

  const leftX = margin;
  const rightX = margin + columnWidth + columnGap;
  let leftY = cursorY;
  let rightY = cursorY;

  drawLabel('From', leftX, leftY);
  leftY += 18;
  leftY += drawValue(primarySenderName, leftX, leftY, { bold: true, maxWidth: columnWidth }) * 14;
  if (secondarySenderName) {
    leftY += drawValue(secondarySenderName, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }
  if (senderAddress) {
    leftY += drawValue(senderAddress, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }
  if (senderEmail) {
    leftY += drawMuted(`Email: ${senderEmail}`, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }
  if (senderWebsite) {
    leftY += drawMuted(`Website: ${senderWebsite}`, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }
  if (senderPhone) {
    leftY += drawMuted(`Phone: ${senderPhone}`, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }
  if (senderVatNumber) {
    leftY += drawMuted(`VAT/Tax ID: ${senderVatNumber}`, leftX, leftY, { maxWidth: columnWidth }) * 13;
  }

  drawLabel('Client', rightX, rightY);
  rightY += 18;
  rightY += drawValue(client?.name || '', rightX, rightY, { bold: true, maxWidth: columnWidth }) * 14;
  if (client?.address) {
    rightY += drawValue(client.address, rightX, rightY, { maxWidth: columnWidth }) * 13;
  }
  if (client?.vatNumber) {
    rightY += drawMuted(`VAT/Tax ID: ${client.vatNumber}`, rightX, rightY, { maxWidth: columnWidth }) * 13;
  }
  rightY += drawMuted(`Client ID: ${client?.displayId || ''}`, rightX, rightY, { maxWidth: columnWidth }) * 13;

  cursorY = Math.max(leftY, rightY) + 28;

  if (paymentMethods.length) {
    drawLabel('Payment details', margin, cursorY);
    let paymentY = cursorY + 18;
    paymentMethods.forEach((method) => {
      paymentY += drawValue(method.type ? `${method.label} (${method.type})` : method.label, margin, paymentY, { bold: true, maxWidth: contentWidth }) * 14;
      if (method.details) {
        paymentY += drawMuted(method.details, margin, paymentY, { maxWidth: contentWidth }) * 13;
      }
      paymentY += 6;
    });
    cursorY = paymentY + 8;
  }

  pdf.setFillColor(248, 250, 252);
  pdf.rect(margin, cursorY, contentWidth, 28, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(margin, cursorY, contentWidth, 28);

  const descriptionWidth = contentWidth - 220;
  const netX = margin + descriptionWidth + 12;
  const vatX = netX + 72;
  const totalX = vatX + 78;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Description', margin + 12, cursorY + 18);
  pdf.text('Net', netX, cursorY + 18);
  pdf.text('VAT', vatX, cursorY + 18);
  pdf.text('Total', totalX, cursorY + 18);

  cursorY += 28;
  const descriptionLines = pdf.splitTextToSize(sanitize(invoice.description || 'Invoice item'), descriptionWidth - 24);
  const rowHeight = Math.max(34, descriptionLines.length * 14 + 12);

  pdf.rect(margin, cursorY, contentWidth, rowHeight);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(descriptionLines, margin + 12, cursorY + 18);
  pdf.text(money(invoice.subtotal), netX, cursorY + 18);
  pdf.text(`${Number(invoice.vatRate || 0)}%`, vatX, cursorY + 18);
  pdf.text(money(invoice.total), totalX, cursorY + 18);

  cursorY += rowHeight + 26;

  const totalsBoxWidth = 220;
  const totalsX = pageWidth - margin - totalsBoxWidth;
  const totals = [
    [`Subtotal (${defaultCurrency})`, money(invoice.subtotal)],
    [`VAT (${defaultCurrency})`, money(invoice.vatAmount)],
    [`Total (${defaultCurrency})`, money(invoice.total)],
  ];
  if (hasClientCurrencyTotal) {
    totals.push([`Total (${clientCurrency})`, formatCurrency(invoice.clientCurrencyTotal, clientCurrency)]);
  }
  pdf.rect(totalsX, cursorY, totalsBoxWidth, 10 + totals.length * 22);
  totals.forEach((entry, index) => {
    const rowY = cursorY + 20 + index * 22;
    if (index > 0) {
      pdf.setDrawColor(226, 232, 240);
      pdf.line(totalsX, rowY - 12, totalsX + totalsBoxWidth, rowY - 12);
    }
    pdf.setFont('helvetica', index === totals.length - 1 ? 'bold' : 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(entry[0], totalsX + 12, rowY);
    pdf.text(entry[1], totalsX + totalsBoxWidth - 12, rowY, { align: 'right' });
  });

  if (cursorY + 120 > pageHeight - margin) {
    pdf.addPage();
  }

  const fileName = sanitize(invoice.invoiceNumber || 'invoice').replace(/[^a-z0-9-_]+/gi, '-') || 'invoice';
  pdf.save(`${fileName}.pdf`);
}
