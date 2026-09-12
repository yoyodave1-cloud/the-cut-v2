import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useFeaturedSections } from '../api';
import SectionTitle from './SectionTitle';
import { FeaturedVideoCard } from './VideoFeedCards';

export default function FeaturedCreatorSection() {
  const { creator } = useFeaturedSections();
  if (!creator) return null;
  if (creator.cardType !== 'featured_video') return null;

  return (
    <>
      <SectionTitle
        subtitle="FEATURED"
        big="Creator"
        small="golf"
        scheme="dark"
      />
      <View style={styles.cardWrap}>
        <FeaturedVideoCard
          {...(creator.card as React.ComponentProps<typeof FeaturedVideoCard>)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardWrap: { marginTop: 22 },
});
