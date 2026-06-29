import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Article } from '../api';
import { useOpenArticle } from '../ArticleReader';
import { colors } from '../constants/colors';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NewsCardCompact({ article, tag }: { article: Article; tag?: string }) {
  const openArticle = useOpenArticle();
  return (
    <TouchableOpacity
      style={styles.compactCard}
      activeOpacity={0.8}
      onPress={() => openArticle(article.url, article.title)}
    >
      {tag ? <Text style={styles.scaledTagLabel}>{tag}</Text> : null}
      <View style={[styles.compactCardRow, { marginTop: tag ? 8 : 0 }]}>
        <View style={styles.compactCardText}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {article.title}
          </Text>
          <Text style={styles.compactCardMeta}>
            {article.source?.name} · {timeAgo(article.publishedAt)}
          </Text>
        </View>
        {article.urlToImage ? (
          <Image source={{ uri: article.urlToImage }} style={styles.compactThumb} />
        ) : (
          <View style={[styles.compactThumb, { backgroundColor: colors.midNavy }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export function TrendingList({
  articles,
  title = 'Trending in golf',
}: {
  articles: Article[];
  title?: string;
}) {
  const openArticle = useOpenArticle();
  const dots = [colors.liveBlue, colors.eagleAmber, colors.birdieGreen, colors.bogeyRed];
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.scaledTagLabel}>News</Text>
      <Text style={styles.sectionTitleScaled}>{title}</Text>
      <View style={styles.trendingBox}>
        {articles.slice(0, 4).map((a, i) => (
          <TouchableOpacity
            key={a.url || `${a.title}-${a.publishedAt}-${i}`}
            activeOpacity={0.7}
            onPress={() => openArticle(a.url, a.title)}
            style={[
              styles.trendingRow,
              i < articles.length - 1 ? styles.trendingDivider : null,
            ]}
          >
            <View style={[styles.trendingDot, { backgroundColor: dots[i % dots.length] }]} />
            <Text style={styles.trendingText} numberOfLines={2}>
              {a.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scaledTagLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.coolGrey,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  compactCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 15,
    marginBottom: 13,
  },
  compactCardRow: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
  },
  compactCardText: { flex: 1, minWidth: 0, paddingTop: 1 },
  compactThumb: { width: 100, height: 100, borderRadius: 10, flexShrink: 0 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.navy, lineHeight: 23 },
  compactCardMeta: { fontSize: 13, color: colors.coolGrey, marginTop: 5 },
  sectionTitleScaled: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 8, marginBottom: 3 },
  trendingBox: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 10,
  },
  trendingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15 },
  trendingDivider: { borderBottomWidth: 0.5, borderBottomColor: '#E5E9EE' },
  trendingDot: { width: 20, height: 20, borderRadius: 5, marginTop: 2 },
  trendingText: { fontSize: 16, fontWeight: '600', color: colors.navy, flex: 1, lineHeight: 23 },
});
