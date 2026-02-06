// Fuzzy string matching utilities

export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(a, b);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

export function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.split(' ').sort().join(' ');
  const sortedB = b.split(' ').sort().join(' ');
  return levenshteinRatio(sortedA, sortedB);
}

export function partialRatio(a: string, b: string): number {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  if (shorter.length === 0) return 0;
  
  let maxRatio = 0;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    const substring = longer.substring(i, i + shorter.length);
    const ratio = levenshteinRatio(shorter, substring);
    maxRatio = Math.max(maxRatio, ratio);
  }
  
  return maxRatio;
}

export function namesMatch(a: string, b: string, threshold = 80): boolean {
  if (!a || !b) return false;
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  return tokenSortRatio(normalizedA, normalizedB) >= threshold;
}

export function projectMatch(a: string, b: string, threshold = 75): boolean {
  if (!a || !b) return false;
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  return partialRatio(normalizedA, normalizedB) >= threshold;
}
