/* SportiQ Club — integração com Google Sheets (CSV público).
   Coloque este arquivo ao lado de index.html e carregue após o script do catálogo.
   O catálogo original permanece como reserva se a leitura falhar. */
(() => {
  'use strict';
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiACeVE74IUNBvdH9V0o5ONSFnyrRB2fviOzM_f3mbldWytwjcALo4hkThwjqBXc7nZdh7yjTnWwr1/pub?gid=627435781&single=true&output=csv';
  const existing = new Map(products.map(p => [String(p.id).toLowerCase(), {...p}]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  function parseCSV(text) {
    const out = [], row = []; let field = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') {field += '"'; i++;}
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {row.push(field); field = '';}
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(x => x.trim())) out.push([...row]);
        row.length = 0; field = '';
      } else field += ch;
    }
    if (quoted) throw new Error('CSV contém aspas não fechadas');
    row.push(field);
    if (row.some(x => x.trim())) out.push(row);
    return out;
  }
  function priceBR(value) {
    let x = String(value ?? '').replace(/[^0-9,.-]/g, '');
    if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
    const n = Number(x);
    return x && Number.isFinite(n) && n >= 0 ? n : NaN;
  }
  const defaultEmoji = {'Futebol':'⚽','Corrida':'🏃','Natação':'🏊','Musculação':'🏋️','Lutas':'🥊','Vôlei':'🏐'};
  async function sync() {
    try {
      const res = await fetch(CSV_URL + '&v=' + Date.now(), {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = parseCSV(await res.text());
      if (data.length < 2) throw new Error('Planilha vazia');
      const headers = data.shift().map(normalize);
      const col = name => headers.findIndex(h => h === name || h.startsWith(name + ' '));
      const cols = {id:col('id'), name:col('nome'), price:col('preco'), desc:col('descricao'), category:col('categoria'), aisle:col('corredor'), shelf:col('prateleira'), image:col('imagem')};
      if ([cols.id,cols.name,cols.price,cols.category].some(i => i < 0)) throw new Error('Colunas obrigatórias não encontradas');
      const items = data.map(row => {
        const id = String(row[cols.id] ?? '').trim().toLowerCase();
        const name = String(row[cols.name] ?? '').trim();
        const cat = String(row[cols.category] ?? '').trim();
        const price = priceBR(row[cols.price]);
        if (!id || !name || !cat || !Number.isFinite(price)) return null;
        const old = existing.get(id) ?? {};
        const image = cols.image >= 0 ? String(row[cols.image] ?? '').trim() : '';
        const emoji = /^https?:\/\//i.test(image) ? old.emoji || '🏷️' : image || old.emoji || '🏷️';
        // O catálogo usa innerHTML: escapar texto vindo de fora.
        const item = {id, name:safe(name), price, category:safe(cat), desc:safe(cols.desc >= 0 ? row[cols.desc] : old.desc), aisle:safe(cols.aisle >= 0 ? row[cols.aisle] : old.aisle || '—'), shelf:safe(cols.shelf >= 0 ? row[cols.shelf] : old.shelf || '—'), emoji:safe(emoji), badge:old.badge || ''};
        if (image.startsWith('https://') && !/[\s<>"']/.test(image)) productImages[id] = image;
        else if (!productImages[id]) productImages[id] = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" fill="#1a241e"/><text x="50%" y="55%" fill="#e8ff24" text-anchor="middle" font-size="35">SportiQ</text></svg>');
        return item;
      }).filter(Boolean);
      if (!items.length) throw new Error('Sem produtos válidos');
      // Mantém a referência do array usada pelo código atual.
      products.splice(0, products.length, ...items);
      const known = new Set(categories.map(c => c.name));
      for (const item of items) if (!known.has(item.category)) {
        categories.push({name:item.category,emoji:defaultEmoji[item.category] || '🏅',purpose:'Produtos da loja'});
        known.add(item.category);
      }
      for (const id of Object.keys(cart)) if (!products.some(p => p.id === id)) delete cart[id];
      renderCategories(); renderProducts(); updateCart();
      console.info('SportiQ: catálogo atualizado pelo Google Sheets (' + items.length + ' produtos).');
    } catch(error) {
      console.warn('SportiQ: não foi possível acessar o Google Sheets. Catálogo local preservado.', error);
    }
  }
  sync();
})();
