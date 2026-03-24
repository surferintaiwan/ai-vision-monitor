import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDeviceEvents } from '@/services/firebase/events';
import { DetectionEvent } from '@/types';

type EventListParams = {
  EventList: { cameraDeviceId: string };
};

export function EventListScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<EventListParams, 'EventList'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cameraDeviceId } = route.params;

  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeviceEvents(cameraDeviceId, 100)
      .then(setEvents)
      .catch((err) => console.warn('Failed to fetch events:', err))
      .finally(() => setLoading(false));
  }, [cameraDeviceId]);

  function formatTime(date: Date): string {
    return date.toLocaleString();
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'person': return 'P';
      case 'sound': return 'S';
      case 'motion': return 'M';
      default: return '?';
    }
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case 'person': return '#f44336';
      case 'sound': return '#ff9800';
      case 'motion': return '#4caf50';
      default: return '#666';
    }
  }

  function renderEvent({ item }: { item: DetectionEvent }) {
    return (
      <View style={styles.eventCard}>
        <View style={[styles.typeIcon, { backgroundColor: getTypeColor(item.type) }]}>
          <Text style={styles.typeIconText}>{getTypeIcon(item.type)}</Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventType}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            {item.soundClass ? ` (${item.soundClass})` : ''}
          </Text>
          <Text style={styles.eventConfidence}>
            Confidence: {Math.round(item.confidence * 100)}%
          </Text>
          <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
        </View>
        {item.clipPath && (
          <View style={styles.clipBadge}>
            <Text style={styles.clipText}>{item.clipDurationSec}s</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Events</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4A90D9" style={styles.loader} />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No events recorded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backText: {
    color: '#4A90D9',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  loader: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#a0a0b0',
    fontSize: 16,
  },
  list: {
    padding: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  eventInfo: {
    flex: 1,
  },
  eventType: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  eventConfidence: {
    color: '#a0a0b0',
    fontSize: 12,
    marginTop: 2,
  },
  eventTime: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  clipBadge: {
    backgroundColor: 'rgba(74,144,217,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clipText: {
    color: '#4A90D9',
    fontSize: 12,
    fontWeight: '600',
  },
});
