import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BORDER_RADIUS } from '../constants/theme';

interface PolicyDocumentProps {
  /** Markdown-lite source: `#`/`##`/`###` headings, `- ` bullets,
   *  `**bold**`, `---` dividers, blank lines as spacing. */
  content: string;
  isRTL: boolean;
  COLORS: any;
}

/** Renders a legal/policy document with proper typographic hierarchy
 *  instead of one raw text block. Content is rendered, never rewritten. */
function renderInline(text: string, style: any) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <Text key={i} style={[style, { fontWeight: '800' }]}>
        {p.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i} style={style}>
        {p}
      </Text>
    )
  );
}

export default function PolicyDocument({ content, isRTL, COLORS }: PolicyDocumentProps) {
  const s = createStyles(COLORS, isRTL);
  const lines = content.replace(/\r/g, '').split('\n');

  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <View key={i} style={{ height: 10 }} />;
        if (line === '---') return <View key={i} style={s.divider} />;
        if (line.startsWith('### '))
          return (
            <Text key={i} style={s.h3}>
              {line.slice(4)}
            </Text>
          );
        if (line.startsWith('## '))
          return (
            <View key={i} style={s.h2Row}>
              <View style={s.h2Bar} />
              <Text style={s.h2}>{line.slice(3)}</Text>
            </View>
          );
        if (line.startsWith('# '))
          return (
            <Text key={i} style={s.h1}>
              {line.slice(2)}
            </Text>
          );
        if (line.startsWith('- '))
          return (
            <View key={i} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.bulletText}>{renderInline(line.slice(2), s.bulletText)}</Text>
            </View>
          );
        return (
          <Text key={i} style={s.paragraph}>
            {renderInline(line, s.paragraph)}
          </Text>
        );
      })}
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    h1: {
      fontSize: 22,
      fontWeight: '800',
      color: C.text,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    h2Row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 22,
      marginBottom: 8,
    },
    h2Bar: {
      width: 4,
      height: 18,
      borderRadius: 2,
      backgroundColor: C.primary,
    },
    h2: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text,
      flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
    h3: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
      marginTop: 12,
      marginBottom: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 23,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    bulletRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginVertical: 3,
      paddingHorizontal: 2,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.primary,
      marginTop: 9,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 23,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    divider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: 18,
      borderRadius: BORDER_RADIUS?.sm ?? 4,
    },
  });
