import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useFeaturedSections, type FeaturedSectionSlice } from '../api';
import { FeaturedNewsCard } from './FeedNewsCards';
import SectionTitle from './SectionTitle';
import { FeaturedVideoCard } from './VideoFeedCards';

function FeaturedCard({ section }: { section: FeaturedSectionSlice }) {
  if (section.cardType === 'large_news') {
    return <FeaturedNewsCard {...(section.card as React.ComponentProps<typeof FeaturedNewsCard>)} />;
  }
  if (section.cardType === 'featured_video') {
    return (
      <FeaturedVideoCard {...(section.card as React.ComponentProps<typeof FeaturedVideoCard>)} />
    );
  }
  return null;
}

export default function FeaturedTourSection() {
  const { tour } = useFeaturedSections();
  if (!tour) return null;

  return (
    <>
      <SectionTitle
        subtitle="FEATURED"
        big="Tour"
        small="golf"
        scheme="light"
      />
      <View style={styles.cardWrap}>
        <FeaturedCard section={tour} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardWrap: { marginTop: 22 },
});
