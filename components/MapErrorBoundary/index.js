import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Map Error Boundary Caught:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>مشكلة في الخريطة 😕</Text>
          <Text style={styles.message}>تحقق من الإذن أو الاتصال بالإنترنت</Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>إعادة تحميل الخريطة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  message: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default MapErrorBoundary;
