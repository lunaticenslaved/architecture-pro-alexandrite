const { NodeTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const grpc = require('@grpc/grpc-js');

// Настройка экспортера трассировки (отправка в Collector)
const exporter = new OTLPTraceExporter({
  url: 'http://simplest-collector:4317',
  credentials: grpc.credentials.createInsecure(),
});

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'service-b',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessors: [new SimpleSpanProcessor(exporter)]
});

provider.register();
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});

const express = require('express');
const axios = require('axios');
const { trace, context, propagation } = require('@opentelemetry/api');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware для логирования всех запросов (опционально)
app.use((req, res, next) => {
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.setAttribute('http.request_id', req.headers['x-request-id'] || 'unknown');
    currentSpan.setAttribute('http.user_agent', req.headers['user-agent'] || 'unknown');
  }
  next();
});

// GET метод, который вызывает service-b
app.get('/', async (req, res) => {
  const tracer = trace.getTracer('service-a-tracer');
  
  // Создаем спаны для отслеживания
  await tracer.startActiveSpan('root-endpoint', async (span) => {
    // Добавляем атрибуты к спану
    span.setAttribute('http.method', 'GET');
    span.setAttribute('service.target', 'service-b');
    
    res.status(200).json("hello from service-b");

    span.end();
  });
});

// Простой health-check эндпоинт
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'service-a' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
  console.log(`OpenTelemetry is enabled`);
  console.log(`Endpoint: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});
