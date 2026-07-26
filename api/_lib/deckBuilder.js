import { v4 as uuidv4 } from 'uuid';

const COLORS = ['red', 'blue', 'green', 'yellow'];

function card(type, color, value, label) {
  return { id: uuidv4(), type, color, value: value ?? null, label };
}

export function buildDeck() {
  const deck = [];

  for (const color of COLORS) {
    // 0 — one per color
    deck.push(card('number', color, 0, '0'));

    // 1–9 — two per color
    for (let n = 1; n <= 9; n++) {
      deck.push(card('number', color, n, String(n)));
      deck.push(card('number', color, n, String(n)));
    }

    // Action cards — two per color
    for (let i = 0; i < 2; i++) {
      deck.push(card('skip', color, null, 'Skip'));
      deck.push(card('reverse', color, null, 'Reverse'));
      deck.push(card('draw2', color, null, 'Draw 2'));
    }

    // Custom colored cards — one per color
    deck.push(card('shield', color, null, 'Shield'));
    deck.push(card('peek', color, null, 'Peek'));
  }

  // Wild cards — 4 of each
  for (let i = 0; i < 4; i++) {
    deck.push(card('wild', 'wild', null, 'Wild'));
    deck.push(card('wild_draw4', 'wild', null, 'Wild Draw 4'));
  }

  // Custom wild cards
  for (let i = 0; i < 2; i++) {
    deck.push(card('swap_hands', 'wild', null, 'Swap Hands'));
    deck.push(card('draw_until_color', 'wild', null, 'Draw Until Color'));
    deck.push(card('discard_color', 'wild', null, 'Discard Color'));
    deck.push(card('sabotage', 'wild', null, 'Sabotage'));
  }

  return deck;
}
