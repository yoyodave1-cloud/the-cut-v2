import React, { useCallback, useEffect, useState } from 'react';
import { Image, type DimensionValue } from 'react-native';
import { youtubeThumbnailUri } from '../constants/creators';
import { colors } from '../constants/colors';

/** Shared YouTube thumb used on creator profile Shorts rows (90×160) and elsewhere. */
export default function ProfileYoutubeThumb({
  videoId,
  imageUrl,
  width,
  height,
  aspectRatio,
  borderRadius = 0,
}: {
  videoId: string;
  imageUrl?: string;
  width: DimensionValue;
  height?: DimensionValue;
  aspectRatio?: number;
  borderRadius?: number;
}) {
  const [uri, setUri] = useState(() => imageUrl || youtubeThumbnailUri(videoId, 'max'));
  useEffect(() => {
    setUri(imageUrl || youtubeThumbnailUri(videoId, 'max'));
  }, [imageUrl, videoId]);
  const onError = useCallback(() => {
    setUri((cur) => {
      const hq = youtubeThumbnailUri(videoId, 'hq');
      return cur === hq ? cur : hq;
    });
  }, [videoId]);
  return (
    <Image
      source={{ uri }}
      style={{
        width,
        height,
        aspectRatio,
        borderRadius,
        backgroundColor: colors.midNavy,
      }}
      resizeMode="cover"
      onError={onError}
    />
  );
}
