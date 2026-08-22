import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
// Da expo-router e non da @react-navigation/bottom-tabs: expo-router
// incorpora la sua copia del navigator, e mescolare le due fa litigare
// i tipi dei descriptor su una differenza che a runtime non esiste.
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs';
import { View } from 'react-native';
import { MiniPlayer } from '@/components/MiniPlayer';
import { colors } from '@/theme';

/**
 * Il MiniPlayer va *sopra* la tab bar, non sotto. Montato nel layout
 * radice finiva in fondo allo schermo, sotto i tab e a ridosso della
 * barra dei gesti: lo Stack (e con lui la tab bar) occupa tutta l'altezza.
 *
 * La soluzione e' sostituire la tab bar con una che disegna prima il
 * MiniPlayer e poi quella originale. Resta montato passando da un tab
 * all'altro, e l'inset inferiore continua a gestirlo BottomTabBar.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <View>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scopri',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Cerca',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Libreria',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
