import {
  state,
  uiState,
  elements,
  getDesktopEncryptionStatus,
  normalizeProfile,
  saveState,
  getClient,
  readFileAsDataUrl,
  serializeStateForBackup,
  restoreStateFromRaw,
} from './state.js';

let profileHooks = {
  renderAll: () => {},
};

export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text || '').replace(/[&<>"']/g, (char) => map[char]);
}

export function registerProfileHooks(hooks) {
  profileHooks = { ...profileHooks, ...hooks };
}

export function resetBusinessForm() {
  uiState.editingBusinessId = '';
  elements.profileBusinessNameInput.value = '';
  elements.profileBusinessWebsiteInput.value = '';
  elements.profileBusinessContactEmailInput.value = '';
  elements.profileBusinessLogoInput.value = '';
  elements.addBusinessNameBtn.textContent = 'Add trading name';
  elements.cancelBusinessEditBtn.hidden = true;
}

function resetPaymentMethodForm() {
  uiState.editingPaymentMethodId = '';
  elements.profilePaymentMethodLabelInput.value = '';
  elements.profilePaymentMethodTypeInput.value = '';
  elements.profilePaymentMethodDetailsInput.value = '';
  elements.profilePaymentMethodDefaultInput.checked = false;
  elements.addPaymentMethodBtn.textContent = 'Add payment method';
  elements.cancelPaymentMethodEditBtn.hidden = true;
}

function startPaymentMethodEdit(paymentMethodId) {
  const method = state.profile.paymentMethods.find((item) => item.id === paymentMethodId);
  if (!method) return;
  uiState.editingPaymentMethodId = method.id;
  elements.profilePaymentMethodLabelInput.value = method.label || '';
  elements.profilePaymentMethodTypeInput.value = method.type || '';
  elements.profilePaymentMethodDetailsInput.value = method.details || '';
  elements.profilePaymentMethodDefaultInput.checked = Boolean(method.includeByDefault);
  elements.addPaymentMethodBtn.textContent = 'Save payment method';
  elements.cancelPaymentMethodEditBtn.hidden = false;
  elements.profilePaymentMethodLabelInput.focus();
}

export function startBusinessEdit(businessId) {
  const business = state.profile.businesses.find((item) => item.id === businessId);
  if (!business) return;
  uiState.editingBusinessId = business.id;
  elements.profileBusinessNameInput.value = business.name || '';
  elements.profileBusinessWebsiteInput.value = business.website || '';
  elements.profileBusinessContactEmailInput.value = business.contactEmail || '';
  elements.profileBusinessLogoInput.value = '';
  elements.addBusinessNameBtn.textContent = 'Save trading name';
  elements.cancelBusinessEditBtn.hidden = false;
  elements.profileBusinessNameInput.focus();
}

export function resolveInvoiceIssuerName(invoice) {
  if (invoice.issuerType === 'business' && invoice.issuerBusinessId) {
    const business = state.profile.businesses.find((item) => item.id === invoice.issuerBusinessId);
    if (business) return business.name;
  }
  if (invoice.issuerName) return invoice.issuerName;
  return state.profile.legalName || '';
}

export function renderIssuerOptions(selectedValue = '') {
  const fallbackValue = 'legal';
  elements.invoiceIssuerSelect.innerHTML = '';

  const legalOption = document.createElement('option');
  legalOption.value = fallbackValue;
  legalOption.textContent = state.profile.legalName
    ? `${state.profile.legalName} (legal name)`
    : 'Legal name (set this in Profile)';
  elements.invoiceIssuerSelect.appendChild(legalOption);

  state.profile.businesses.forEach((business) => {
    const option = document.createElement('option');
    option.value = `business:${business.id}`;
    option.textContent = `${business.name} (business)`;
    elements.invoiceIssuerSelect.appendChild(option);
  });

  const desiredValue = selectedValue || elements.invoiceIssuerSelect.value || fallbackValue;
  const hasDesired = Array.from(elements.invoiceIssuerSelect.options).some((option) => option.value === desiredValue);
  elements.invoiceIssuerSelect.value = hasDesired ? desiredValue : fallbackValue;
}

function sanitizeLogoDataUrl(value) {
  const src = String(value || '').trim();
  return src.startsWith('data:image/') ? src : '';
}

export function getInvoiceSenderDetails(invoice) {
  const client = getClient(invoice.clientId);
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

  return {
    client,
    senderName,
    senderBusiness,
    senderLegalName,
    primarySenderName: senderLegalName || senderName || '',
    secondarySenderName,
    senderAddress: state.profile.address || '',
    senderEmail: senderBusiness?.contactEmail || state.profile.email || '',
    senderWebsite: senderBusiness?.website || '',
    senderPhone: state.profile.phone || '',
    senderVatNumber: state.profile.vatNumber || '',
    senderLogoDataUrl: senderBusiness?.logoDataUrl || '',
  };
}

export async function renderProfile() {
  document.getElementById('profilePersonalName').value = state.profile.personalName || '';
  document.getElementById('profileLegalName').value = state.profile.legalName || '';
  document.getElementById('profileEmail').value = state.profile.email || '';
  document.getElementById('profilePhone').value = state.profile.phone || '';
  document.getElementById('profileVatNumber').value = state.profile.vatNumber || '';
  document.getElementById('profileAddress').value = state.profile.address || '';
  document.getElementById('profileReportingCurrency').value = state.profile.reportingCurrency || 'EUR';

  const encryptionStatusEl = document.getElementById('profile-encryption-status');
  if (encryptionStatusEl) {
    const status = await getDesktopEncryptionStatus();
    encryptionStatusEl.classList.remove('ok', 'warn');
    if (status.ok && status.available) {
      encryptionStatusEl.classList.add('ok');
      encryptionStatusEl.textContent = 'Storage security: the main saved data file is encrypted on this device. Safety backups and exported backup files are kept as readable restore copies. We recommend using this app on a password-protected machine.';
    } else {
      encryptionStatusEl.classList.add('warn');
      encryptionStatusEl.textContent = 'Storage security: encrypted storage is unavailable here, so saved data and local safety backups are stored in plain text on this device. We recommend using this app on a password-protected machine.';
    }
  }

  elements.businessNameList.innerHTML = '';
  if (!state.profile.businesses.length) {
    elements.businessNameList.innerHTML = '<p class="empty-state">No business names added yet.</p>';
    return;
  }

  state.profile.businesses.forEach((business) => {
    const row = document.createElement('div');
    row.className = 'business-name-row';

    const main = document.createElement('div');
    main.className = 'business-name-main';

    const name = document.createElement('span');
    name.className = 'business-name-text';
    name.textContent = business.name;
    main.appendChild(name);

    if (business.website) {
      const website = document.createElement('span');
      website.className = 'business-name-meta';
      website.textContent = `Website: ${business.website}`;
      main.appendChild(website);
    }

    if (business.contactEmail) {
      const email = document.createElement('span');
      email.className = 'business-name-meta';
      email.textContent = `Email: ${business.contactEmail}`;
      main.appendChild(email);
    }

    const actions = document.createElement('div');
    actions.className = 'business-name-actions';

    const safeLogoSrc = sanitizeLogoDataUrl(business.logoDataUrl);
    if (safeLogoSrc) {
      const logo = document.createElement('img');
      logo.className = 'business-logo-preview';
      logo.src = safeLogoSrc;
      logo.alt = `${business.name} logo`;
      actions.appendChild(logo);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'chip-btn';
    editBtn.dataset.action = 'edit-business';
    editBtn.dataset.id = business.id;
    editBtn.textContent = 'Edit';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger-btn';
    removeBtn.dataset.action = 'remove-business';
    removeBtn.dataset.id = business.id;
    removeBtn.textContent = 'Remove';

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);

    row.appendChild(main);
    row.appendChild(actions);
    elements.businessNameList.appendChild(row);
  });

  elements.paymentMethodList.innerHTML = '';
  if (!state.profile.paymentMethods.length) {
    elements.paymentMethodList.innerHTML = '<p class="empty-state">No payment methods added yet.</p>';
    return;
  }

  state.profile.paymentMethods.forEach((method) => {
    const row = document.createElement('div');
    row.className = 'business-name-row';

    const main = document.createElement('div');
    main.className = 'business-name-main';

    const title = document.createElement('span');
    title.className = 'business-name-text';
    title.textContent = method.type ? `${method.label} (${method.type})` : method.label;
    main.appendChild(title);

    if (method.details) {
      const details = document.createElement('span');
      details.className = 'business-name-meta';
      details.textContent = method.details;
      main.appendChild(details);
    }

    if (method.includeByDefault) {
      const badge = document.createElement('span');
      badge.className = 'business-name-meta';
      badge.textContent = 'Included by default on invoices';
      main.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'business-name-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'chip-btn';
    editBtn.dataset.action = 'edit-payment-method';
    editBtn.dataset.id = method.id;
    editBtn.textContent = 'Edit';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger-btn';
    removeBtn.dataset.action = 'remove-payment-method';
    removeBtn.dataset.id = method.id;
    removeBtn.textContent = 'Remove';

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    row.appendChild(main);
    row.appendChild(actions);
    elements.paymentMethodList.appendChild(row);
  });
}

export function attachProfileHandlers() {
  elements.profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(elements.profileForm);
    state.profile.personalName = String(formData.get('profilePersonalName') || '').trim();
    state.profile.legalName = String(formData.get('profileLegalName') || '').trim();
    state.profile.email = String(formData.get('profileEmail') || '').trim();
    state.profile.phone = String(formData.get('profilePhone') || '').trim();
    state.profile.vatNumber = String(formData.get('profileVatNumber') || '').trim();
    state.profile.address = String(formData.get('profileAddress') || '').trim();
    state.profile.reportingCurrency = String(formData.get('profileReportingCurrency') || 'EUR').trim();
    normalizeProfile();
    saveState();
    profileHooks.renderAll();

    if (uiState.profileSaveFeedbackTimeout) {
      clearTimeout(uiState.profileSaveFeedbackTimeout);
    }
    elements.profileSaveFeedback.hidden = false;
    uiState.profileSaveFeedbackTimeout = setTimeout(() => {
      elements.profileSaveFeedback.hidden = true;
    }, 2200);
  });

  if (elements.exportBackupBtn) {
    elements.exportBackupBtn.addEventListener('click', async () => {
      if (typeof window.desktopStore?.exportBackup !== 'function') return;

      elements.backupStatus.classList.remove('ok', 'warn');
      elements.backupStatus.textContent = 'Creating backup file…';
      const result = await window.desktopStore.exportBackup(serializeStateForBackup());

      if (result?.ok) {
        elements.backupStatus.classList.add('ok');
        elements.backupStatus.textContent = `Backup exported successfully to ${result.path}.`;
        return;
      }

      if (result?.canceled) {
        elements.backupStatus.textContent = 'Backup export cancelled.';
        return;
      }

      elements.backupStatus.classList.add('warn');
      elements.backupStatus.textContent = result?.error || 'Could not export the backup file.';
    });
  }

  if (elements.restoreBackupBtn) {
    elements.restoreBackupBtn.addEventListener('click', async () => {
      if (typeof window.desktopStore?.importBackup !== 'function') return;

      const confirmed = confirm('Restore from a backup file? This will replace the current data shown in the app.');
      if (!confirmed) return;

      elements.backupStatus.classList.remove('ok', 'warn');
      elements.backupStatus.textContent = 'Reading backup file…';
      const result = await window.desktopStore.importBackup();

      if (result?.ok) {
        const restored = await restoreStateFromRaw(result.raw || '');
        if (restored?.ok) {
          elements.backupStatus.classList.add('ok');
          elements.backupStatus.textContent = `Backup restored successfully from ${result.path}.`;
          profileHooks.renderAll();
          return;
        }

        elements.backupStatus.classList.add('warn');
        elements.backupStatus.textContent = restored?.error || 'The selected backup file is not valid.';
        return;
      }

      if (result?.canceled) {
        elements.backupStatus.textContent = 'Backup restore cancelled.';
        return;
      }

      elements.backupStatus.classList.add('warn');
      elements.backupStatus.textContent = result?.error || 'Could not restore the backup file.';
    });
  }

  elements.addBusinessNameBtn.addEventListener('click', async () => {
    const name = String(elements.profileBusinessNameInput.value || '').trim();
    const website = String(elements.profileBusinessWebsiteInput.value || '').trim();
    const contactEmail = String(elements.profileBusinessContactEmailInput.value || '').trim();
    const logoFile = elements.profileBusinessLogoInput.files?.[0] || null;
    if (!name) return;

    const exists = state.profile.businesses.some((business) => {
      if (uiState.editingBusinessId && business.id === uiState.editingBusinessId) return false;
      return business.name.toLowerCase() === name.toLowerCase();
    });
    if (exists) {
      alert('This business name already exists.');
      return;
    }

    const editingBusiness = uiState.editingBusinessId
      ? state.profile.businesses.find((business) => business.id === uiState.editingBusinessId)
      : null;
    let logoDataUrl = editingBusiness?.logoDataUrl || '';
    let logoMimeType = editingBusiness?.logoMimeType || '';
    let logoFileName = editingBusiness?.logoFileName || '';
    if (logoFile) {
      try {
        logoDataUrl = await readFileAsDataUrl(logoFile);
        logoMimeType = logoFile.type || '';
        logoFileName = logoFile.name || '';
      } catch (error) {
        console.error('Could not read trading name logo', error);
        alert('Could not read the selected logo file. Try another image.');
        return;
      }
    }

    if (editingBusiness) {
      editingBusiness.name = name;
      editingBusiness.website = website;
      editingBusiness.contactEmail = contactEmail;
      editingBusiness.logoDataUrl = logoDataUrl;
      editingBusiness.logoMimeType = logoMimeType;
      editingBusiness.logoFileName = logoFileName;
    } else {
      state.profile.businesses.push({
        id: crypto.randomUUID(),
        name,
        website,
        contactEmail,
        logoDataUrl,
        logoMimeType,
        logoFileName,
      });
    }

    resetBusinessForm();
    saveState();
    profileHooks.renderAll();
  });

  elements.cancelBusinessEditBtn.addEventListener('click', () => {
    resetBusinessForm();
  });

  elements.businessNameList.addEventListener('click', (event) => {
    const editButton = event.target.closest('button[data-action="edit-business"]');
    if (editButton) {
      startBusinessEdit(editButton.dataset.id);
      return;
    }

    const removeButton = event.target.closest('button[data-action="remove-business"]');
    if (!removeButton) return;

    state.profile.businesses = state.profile.businesses.filter((business) => business.id !== removeButton.dataset.id);
    if (uiState.editingBusinessId === removeButton.dataset.id) {
      resetBusinessForm();
    }
    saveState();
    profileHooks.renderAll();
  });

  elements.addPaymentMethodBtn.addEventListener('click', () => {
    const label = String(elements.profilePaymentMethodLabelInput.value || '').trim();
    const type = String(elements.profilePaymentMethodTypeInput.value || '').trim();
    const details = String(elements.profilePaymentMethodDetailsInput.value || '').trim();
    const includeByDefault = Boolean(elements.profilePaymentMethodDefaultInput.checked);

    if (!label && !details) {
      alert('Add a method label or payment details.');
      return;
    }

    const editingMethod = uiState.editingPaymentMethodId
      ? state.profile.paymentMethods.find((method) => method.id === uiState.editingPaymentMethodId)
      : null;

    if (editingMethod) {
      editingMethod.label = label;
      editingMethod.type = type;
      editingMethod.details = details;
      editingMethod.includeByDefault = includeByDefault;
    } else {
      state.profile.paymentMethods.push({
        id: crypto.randomUUID(),
        label,
        type,
        details,
        includeByDefault,
      });
    }

    resetPaymentMethodForm();
    saveState();
    profileHooks.renderAll();
  });

  elements.cancelPaymentMethodEditBtn.addEventListener('click', () => {
    resetPaymentMethodForm();
  });

  elements.paymentMethodList.addEventListener('click', (event) => {
    const editButton = event.target.closest('button[data-action="edit-payment-method"]');
    if (editButton) {
      startPaymentMethodEdit(editButton.dataset.id);
      return;
    }

    const removeButton = event.target.closest('button[data-action="remove-payment-method"]');
    if (!removeButton) return;

    const paymentMethodId = removeButton.dataset.id;
    state.profile.paymentMethods = state.profile.paymentMethods.filter((method) => method.id !== paymentMethodId);
    state.clients.forEach((client) => {
      if (client.preferredPaymentMethodId === paymentMethodId) {
        client.preferredPaymentMethodId = '';
      }
    });
    state.invoices.forEach((invoice) => {
      if (invoice.paymentMethodId === paymentMethodId) {
        invoice.paymentMethodId = '';
      }
    });

    if (uiState.editingPaymentMethodId === paymentMethodId) {
      resetPaymentMethodForm();
    }

    saveState();
    profileHooks.renderAll();
  });
}
