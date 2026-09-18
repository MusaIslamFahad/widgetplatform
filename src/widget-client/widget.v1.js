/**
 * FlyRank Capstone — embeddable widget loader (bundle version: v1)
 *
 * This is the ENTIRE file a customer's site downloads via:
 *   <script src="https://your-domain.com/widget.v1.js?id=WIDGET_ID" async></script>
 *
 * It is intentionally dependency-free vanilla JS (no build step, no
 * bundler) so it stays tiny and works on any page, however old. Per the
 * capstone's "realistic scope" (Section 7), styling here is deliberately
 * minimal — the grade is the backend, not the CSS.
 */
(function widgetLoader() {
  'use strict';

  function getCurrentScript() {
    // document.currentScript is reliable for a plain <script src> tag
    // (which is exactly how this file is always loaded).
    return document.currentScript || document.querySelector('script[src*="widget.v1.js"]');
  }

  function getConfigFromScriptTag(scriptEl) {
    var src = scriptEl.src;
    var url = new URL(src);
    var widgetId = url.searchParams.get('id');
    var apiBase = url.origin; // the widget script and the API are same-origin by design
    return { widgetId: widgetId, apiBase: apiBase };
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function assign(key) {
      if (key === 'style') {
        Object.assign(node.style, attrs.style);
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function append(child) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function buildFieldInput(field) {
    var wrapper = el('div', { style: { marginBottom: '10px' } });
    var label = el('label', { style: { display: 'block', fontSize: '13px', marginBottom: '4px' } }, [
      field.label + (field.required ? ' *' : ''),
    ]);

    var input;
    if (field.type === 'textarea') {
      input = el('textarea', {
        name: field.name,
        rows: '3',
        style: { width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
      });
      if (field.required) input.setAttribute('required', 'required');
    } else if (field.type === 'checkbox') {
      input = el('input', { type: 'checkbox', name: field.name });
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      return wrapper;
    } else {
      input = el('input', {
        type: field.type === 'email' ? 'email' : 'text',
        name: field.name,
        style: { width: '100%', boxSizing: 'border-box' },
      });
      if (field.required) input.setAttribute('required', 'required');
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  function buildHoneypotField() {
    // Hidden from real users (display:none + tabindex -1 + autocomplete
    // off) but present in the DOM, so a naive bot that fills every input it
    // finds ends up filling this one. See services/spamCheck.service.js on
    // the backend for what happens when it's non-empty.
    return el('input', {
      type: 'text',
      name: 'website',
      autocomplete: 'off',
      tabindex: '-1',
      'aria-hidden': 'true',
      style: { position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: '0' },
    });
  }

  function renderWidget(container, config, apiBase) {
    container.innerHTML = '';

    var box = el('div', {
      style: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        maxWidth: '360px',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    });

    box.appendChild(el('h3', { style: { margin: '0 0 6px', fontSize: '16px' } }, [config.title]));
    if (config.description) {
      box.appendChild(
        el('p', { style: { margin: '0 0 12px', fontSize: '13px', color: '#555' } }, [config.description])
      );
    }

    var form = el('form', {});
    var statusEl = el('div', { style: { fontSize: '13px', marginTop: '8px' } }, []);

    config.fields.forEach(function addField(field) {
      form.appendChild(buildFieldInput(field));
    });
    form.appendChild(buildHoneypotField());

    var submitBtn = el(
      'button',
      {
        type: 'submit',
        style: {
          width: '100%',
          padding: '8px 12px',
          background: '#111',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        },
      },
      [config.buttonText || 'Submit']
    );
    form.appendChild(submitBtn);
    form.appendChild(statusEl);

    form.addEventListener('submit', function onSubmit(evt) {
      evt.preventDefault();
      submitBtn.disabled = true;
      statusEl.textContent = 'Sending...';

      var formData = new FormData(form);
      var data = {};
      config.fields.forEach(function collect(field) {
        if (field.type === 'checkbox') {
          data[field.name] = formData.get(field.name) === 'on';
        } else {
          data[field.name] = formData.get(field.name) || '';
        }
      });

      fetch(apiBase + '/api/public/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId: config.id,
          data: data,
          website: formData.get('website') || '',
        }),
      })
        .then(function handleResponse(res) {
          return res.json().then(function parse(body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function handleResult(result) {
          if (result.ok) {
            statusEl.textContent = 'Thanks! Your submission was received.';
            form.reset();
          } else {
            statusEl.textContent =
              (result.body && result.body.error && result.body.error.message) || 'Something went wrong.';
          }
        })
        .catch(function handleError() {
          statusEl.textContent = 'Network error — please try again.';
        })
        .finally(function reenable() {
          submitBtn.disabled = false;
        });
    });

    box.appendChild(form);
    container.appendChild(box);
  }

  function mount() {
    var scriptEl = getCurrentScript();
    if (!scriptEl) return;
    var cfgFromTag = getConfigFromScriptTag(scriptEl);
    if (!cfgFromTag.widgetId) {
      // eslint-disable-next-line no-console
      console.error('[flyrank-widget] missing ?id=WIDGET_ID on the script tag');
      return;
    }

    // Insert a mount point right after the <script> tag in the DOM.
    var container = document.createElement('div');
    container.id = 'flyrank-widget-' + cfgFromTag.widgetId;
    scriptEl.parentNode.insertBefore(container, scriptEl.nextSibling);

    fetch(cfgFromTag.apiBase + '/api/public/widgets/' + cfgFromTag.widgetId + '/config')
      .then(function parse(res) {
        if (!res.ok) throw new Error('config fetch failed: ' + res.status);
        return res.json();
      })
      .then(function render(config) {
        renderWidget(container, config, cfgFromTag.apiBase);
      })
      .catch(function handleError(err) {
        // eslint-disable-next-line no-console
        console.error('[flyrank-widget] failed to load widget config:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
