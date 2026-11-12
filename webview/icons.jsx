import React from 'react';
import { objectCategory } from '../src/object-categories.js';

const files = import.meta.glob('./icons/*/*.svg', { eager: true, query: '?raw', import: 'default' });
const paths = new Map(Object.entries(files).map(([file, svg]) => [
  file.slice(8, -4), svg.match(/<path d="([^"]+)"/)?.[1],
]));

export function iconPath(name) {
  return paths.get(name);
}

export function Icon({ name }) {
  return <svg className="ui-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d={iconPath(name)} />
  </svg>;
}

export function markerIcon(sid) {
  if (sid === 'prison') return 'categories/prison';
  if (sid === 'random-squad') return 'categories/squad';
  if (['random-city', 'city-spawner'].includes(sid)) return 'categories/town';
  return `categories/${objectCategory(sid)}`;
}
