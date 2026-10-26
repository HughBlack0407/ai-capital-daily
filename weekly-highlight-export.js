(function () {
  'use strict';

  const button = document.querySelector('[data-export-highlights]');
  const section = document.getElementById('highlights');
  if (!button || !section) return;

  const status = document.querySelector('[data-export-status]');
  const WIDTH = 920;
  const SCALE = 1.5;
  const CARD_X = 52;
  const CARD_W = WIDTH - CARD_X * 2;
  const TEXT_X = CARD_X + 36;
  const TEXT_W = CARD_W - 72;
  const fonts = {
    meta: '16px "Microsoft YaHei", "PingFang SC", sans-serif',
    title: '700 28px "Microsoft YaHei", "PingFang SC", sans-serif',
    badge: '700 16px "Microsoft YaHei", "PingFang SC", sans-serif',
    body: '19px "Microsoft YaHei", "PingFang SC", sans-serif',
    noteLabel: '700 17px "Microsoft YaHei", "PingFang SC", sans-serif',
    note: '18px "Microsoft YaHei", "PingFang SC", sans-serif',
    source: '16px "Microsoft YaHei", "PingFang SC", sans-serif',
  };

  function content(element) {
    return (element?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function paragraphText(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('a').forEach((link) => link.remove());
    return content(copy);
  }

  function wrap(ctx, value, font, width) {
    ctx.font = font;
    const result = [];
    let line = '';
    for (const char of Array.from(value || '')) {
      const next = line + char;
      if (line && ctx.measureText(next).width > width) {
        result.push(line.trimEnd());
        line = char.trimStart();
      } else {
        line = next;
      }
    }
    if (line) result.push(line.trimEnd());
    return result.length ? result : [''];
  }

  function drawLines(ctx, lines, x, y, font, color, lineHeight, draw) {
    if (draw) {
      ctx.font = font;
      ctx.fillStyle = color;
      lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    }
    return y + lines.length * lineHeight;
  }

  function getCards() {
    const articles = Array.from(section.querySelectorAll('article.story'));
    if (!articles.length) {
      return [{ meta: '', title: '本期重点', badge: '', paragraphs: [content(section.querySelector('.empty')) || '本期暂无入选线索。'], notes: [], sources: '' }];
    }
    return articles.map((article) => {
      const links = Array.from(article.querySelectorAll('a[href^="http"]'));
      const sources = Array.from(new Set(links.map((link) => {
        const id = content(link).match(/S\d{2}/)?.[0];
        return `${id ? `[${id}] ` : ''}${new URL(link.href).hostname}`;
      })));
      return {
        meta: content(article.querySelector('.meta')),
        title: content(article.querySelector('h3')),
        badge: content(article.querySelector('.status')),
        paragraphs: Array.from(article.children)
          .filter((element) => element.tagName === 'P' && !element.classList.contains('meta') && !element.classList.contains('source'))
          .map(paragraphText).filter(Boolean),
        notes: Array.from(article.querySelectorAll('.triple > div')).map((element) => {
          const label = content(element.querySelector('b'));
          return { label, text: content(element).slice(label.length).trim() };
        }),
        sources: sources.length ? `来源：${sources.join(' · ')}` : '',
      };
    });
  }

  function cardHeight(ctx, card, top, draw, fixedHeight) {
    if (draw) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(CARD_X, top, CARD_W, fixedHeight);
      ctx.fillStyle = '#9b2237';
      ctx.fillRect(CARD_X, top, 5, fixedHeight);
    }
    let y = top + 32;
    if (card.meta) {
      y = drawLines(ctx, wrap(ctx, card.meta, fonts.meta, TEXT_W), TEXT_X, y, fonts.meta, '#666b6a', 24, draw) + 10;
    }
    y = drawLines(ctx, wrap(ctx, card.title, fonts.title, TEXT_W), TEXT_X, y, fonts.title, '#1b1d1e', 40, draw) + 15;
    if (card.badge) {
      ctx.font = fonts.badge;
      const badgeWidth = Math.min(TEXT_W, ctx.measureText(card.badge).width + 20);
      if (draw) {
        ctx.fillStyle = '#f1e1e4';
        ctx.fillRect(TEXT_X, y, badgeWidth, 27);
      }
      y = drawLines(ctx, [card.badge], TEXT_X + 10, y + 4, fonts.badge, '#7e1f31', 22, draw) + 16;
    }
    for (const paragraph of card.paragraphs) {
      y = drawLines(ctx, wrap(ctx, paragraph, fonts.body, TEXT_W), TEXT_X, y, fonts.body, '#303334', 31, draw) + 13;
    }
    if (card.notes.length) {
      y += 6;
      if (draw) {
        ctx.fillStyle = '#d8d5cd';
        ctx.fillRect(TEXT_X, y, TEXT_W, 1);
      }
      y += 18;
      for (const note of card.notes) {
        y = drawLines(ctx, [note.label], TEXT_X, y, fonts.noteLabel, '#9b2237', 25, draw);
        y = drawLines(ctx, wrap(ctx, note.text, fonts.note, TEXT_W), TEXT_X, y, fonts.note, '#444849', 29, draw) + 11;
      }
    }
    if (card.sources) {
      y += 8;
      y = drawLines(ctx, wrap(ctx, card.sources, fonts.source, TEXT_W), TEXT_X, y, fonts.source, '#666b6a', 24, draw);
    }
    return y - top + 31;
  }

  async function exportImage() {
    const cards = getCards();
    const measure = document.createElement('canvas').getContext('2d');
    const heights = cards.map((card) => cardHeight(measure, card, 0, false, 0));
    const heroText = content(document.querySelector('.hero p'));
    const period = Array.from(document.querySelectorAll('.strip span')).map(content).join('  ·  ');
    const edition = document.body.dataset.edition || 'weekly';
    const logo = document.querySelector('.brand-title img');
    if (logo?.decode) await logo.decode();
    const sourceUrl = edition === 'weekly' ? location.href : new URL(`weekly/${edition}.html`, logo.src).href;
    const footerLines = wrap(measure, `完整内容与可点击原文：${sourceUrl}`, fonts.source, WIDTH - 104);
    const periodLines = wrap(measure, period, fonts.source, WIDTH - 104);
    const HEADER = 230;
    const totalHeight = HEADER + 28 + periodLines.length * 25 + 17 + heights.reduce((sum, height) => sum + height + 20, 0) + 28 + footerLines.length * 25 + 36;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(WIDTH * SCALE);
    canvas.height = Math.round(totalHeight * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, WIDTH, totalHeight);
    ctx.fillStyle = '#171c23';
    ctx.fillRect(0, 0, WIDTH, HEADER);
    ctx.fillStyle = '#9b2237';
    ctx.fillRect(0, 0, WIDTH, 7);
    if (logo?.naturalWidth) ctx.drawImage(logo, 52, 25, 285, 95);
    else drawLines(ctx, ['資本周報'], 52, 35, fonts.title, '#f7f3ea', 40, true);
    drawLines(ctx, ['本周重点'], 52, 128, '700 34px "Microsoft YaHei", sans-serif', '#ffffff', 42, true);
    drawLines(ctx, wrap(ctx, heroText, fonts.source, WIDTH - 104), 52, 174, fonts.source, '#d4d8d9', 25, true);
    let y = HEADER + 28;
    y = drawLines(ctx, periodLines, 52, y, fonts.source, '#666b6a', 25, true) + 17;
    cards.forEach((card, index) => {
      cardHeight(ctx, card, y, true, heights[index]);
      y += heights[index] + 20;
    });
    ctx.fillStyle = '#1b1d1e';
    ctx.fillRect(52, y + 9, WIDTH - 104, 2);
    y += 28;
    drawLines(ctx, footerLines, 52, y, fonts.source, '#666b6a', 25, true);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI资本周报_本周重点_${edition}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = '正在生成…';
    if (status) status.textContent = '';
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await exportImage();
      if (status) status.textContent = 'PNG 已下载，可插入邮件正文。';
    } catch (error) {
      if (status) status.textContent = '生成失败，请刷新页面后重试。';
      console.error(error);
    } finally {
      button.disabled = false;
      button.textContent = '下载本周重点长图';
    }
  });
})();
