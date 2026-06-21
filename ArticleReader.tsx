import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const colors = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  border: '#D8DEE6',
  navy: '#0B1629',
  coolGrey: '#566778',
  liveBlue: '#4A90D9',
};

type OpenArticle = (url: string, title?: string) => void;

const ArticleReaderContext = createContext<OpenArticle>(() => {});

export function useOpenArticle(): OpenArticle {
  return useContext(ArticleReaderContext);
}

type ActiveArticle = { url: string; title: string };

export function ArticleReaderProvider({ children }: { children: React.ReactNode }) {
  const [article, setArticle] = useState<ActiveArticle | null>(null);
  const [loadError, setLoadError] = useState(false);

  const openArticle = useCallback<OpenArticle>((url, title) => {
    if (!url) return;
    setLoadError(false);
    setArticle({ url, title: title ?? '' });
  }, []);

  const close = useCallback(() => {
    setArticle(null);
    setLoadError(false);
  }, []);

  const openInBrowser = useCallback(() => {
    if (article?.url) Linking.openURL(article.url);
  }, [article?.url]);

  return (
    <ArticleReaderContext.Provider value={openArticle}>
      {children}
      <Modal
        visible={article != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.toolbar}>
            <TouchableOpacity onPress={close} style={styles.closeButton} activeOpacity={0.7}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
            {article?.title ? (
              <Text style={styles.toolbarTitle} numberOfLines={1}>
                {article.title}
              </Text>
            ) : (
              <View style={styles.toolbarTitleSpacer} />
            )}
          </View>

          {article && loadError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Couldn't load this article</Text>
              <Text style={styles.errorBody}>
                The page may be unavailable in the app. You can try opening it in your browser
                instead.
              </Text>
              <TouchableOpacity style={styles.browserButton} onPress={openInBrowser} activeOpacity={0.8}>
                <Text style={styles.browserButtonText}>Open in browser</Text>
              </TouchableOpacity>
            </View>
          ) : article ? (
            <WebView
              key={article.url}
              source={{ uri: article.url }}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={colors.liveBlue} />
                </View>
              )}
              onError={() => setLoadError(true)}
              onHttpError={({ nativeEvent }) => {
                if (nativeEvent.statusCode >= 400) setLoadError(true);
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </ArticleReaderContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.card },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    gap: 12,
  },
  closeButton: { paddingVertical: 4, paddingRight: 8 },
  closeText: { fontSize: 16, fontWeight: '600', color: colors.liveBlue },
  toolbarTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.navy },
  toolbarTitleSpacer: { flex: 1 },
  webview: { flex: 1, backgroundColor: colors.card },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.bg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: colors.coolGrey,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  browserButton: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browserButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
