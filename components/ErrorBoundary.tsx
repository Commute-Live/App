import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import * as Updates from 'expo-updates';
import {colors, layout, radii, spacing, typography} from '../theme';
import {logger} from '../lib/logger';

type Props = {
  children: React.ReactNode;
  label?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('React render error', {
      boundary: this.props.label ?? 'app',
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({error: null});
  };

  private reload = () => {
    Updates.reloadAsync().catch(error => {
      logger.error('App reload failed after render error', {
        boundary: this.props.label ?? 'app',
        error: error instanceof Error ? error.message : String(error),
      });
      this.retry();
    });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Close this message and try again. If it keeps happening, reload the app.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={this.retry}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={this.reload}>
              <Text style={styles.primaryButtonText}>Reload</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
    backgroundColor: colors.background,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    padding: layout.cardPaddingLg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
