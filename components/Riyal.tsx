/**
 * Riyal — the new Saudi Riyal currency symbol (SAMA, 2025), replacing "ر.س".
 *
 * The symbol has no glyph in IBM Plex Sans Arabic (nor in most shipped system
 * fonts yet), so it is rendered from the official open-source Saudi Riyal font
 * bundled in assets/fonts (SIL OFL). That font holds exactly one glyph, at the
 * private-use codepoint U+E900 — we use the PUA slot rather than the Unicode
 * U+20C1 one because it is the codepoint the font actually maps everywhere.
 *
 * Usage — drop it in place of the old `{isRTL ? 'ر.س' : 'SAR'}` literal, inside
 * the same <Text>. Nested text inherits the parent's size and colour, so a
 * price keeps rendering as one line at one size:
 *
 *   <Text style={styles.price}>{amount} <Riyal /></Text>
 *
 * Size/colour are inherited by default; pass them only to override.
 */
import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

/** Font family names — also registered in app/_layout.tsx useFonts(). */
export const RIYAL_FONT_REGULAR = 'SaudiRiyal';
export const RIYAL_FONT_BOLD = 'SaudiRiyalBold';

/** The single glyph the riyal font maps (private-use area). */
const RIYAL_GLYPH = '\uE900';

interface RiyalProps {
  /** Font size. Omit to inherit from the surrounding <Text>. */
  size?: number;
  /** Colour. Omit to inherit from the surrounding <Text>. */
  color?: string;
  /** Use the bold cut of the symbol (pairs with bold prices). */
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Riyal({ size, color, bold, style }: RiyalProps) {
  return (
    <Text
      allowFontScaling
      accessibilityLabel="Saudi Riyal"
      style={[
        {
          fontFamily: bold ? RIYAL_FONT_BOLD : RIYAL_FONT_REGULAR,
          // Android: a nested <Text> inherits the parent's fontWeight, and
          // when the requested weight has no cut in this single-glyph family
          // Android falls back to the system font — which lacks U+E900, so
          // the symbol simply didn't render. Pinning weight/style to normal
          // keeps Android on the riyal font.
          fontWeight: 'normal',
          fontStyle: 'normal',
        },
        size != null && { fontSize: size },
        color != null && { color },
        style,
      ]}
    >
      {RIYAL_GLYPH}
    </Text>
  );
}

/**
 * Money — an amount followed by the riyal symbol, the app's standard currency
 * display. Digits are always Latin (0–9) in both languages.
 */
interface MoneyProps {
  value: number | string | null | undefined;
  /** Decimal places. Default 0 (whole riyals), matching most screens. */
  decimals?: number;
  bold?: boolean;
  /** Symbol size override; defaults to inheriting the parent text size. */
  symbolSize?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function formatAmount(
  value: number | string | null | undefined,
  decimals = 0,
): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  // Always 'en-US' — the app never renders Arabic-Indic digits.
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function Money({
  value,
  decimals = 0,
  bold,
  symbolSize,
  color,
  style,
  numberOfLines,
}: MoneyProps) {
  return (
    <Text style={[color != null && { color }, style]} numberOfLines={numberOfLines}>
      {formatAmount(value, decimals)} <Riyal bold={bold} size={symbolSize} color={color} />
    </Text>
  );
}

export default Riyal;

// Kept for the channels a bundled font can't reach — PDF/HTML invoices, CSV and
// XLSX exports, push-notification bodies. Those stay on the textual code.
export const SAR_TEXT = 'SAR';
