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
    [SemanticResourceAttributes.SERVICE_NAME]: 'service-a',
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
    try {
      // Добавляем атрибуты к спану
      span.setAttribute('http.method', 'GET');
      
      console.log('Calling service-b...');
      
      // Вызов другого сервиса (трассировка автоматически продолжится благодаря auto-instrumentation)
      const response = await axios.get('http://service-b:8080/', {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          // OpenTelemetry автоматически инжектит заголовки трассировки
        }
      });
      
      // Добавляем информацию об ответе
      span.setAttribute('service-b.response.status', response.status);
      span.setAttribute('service-b.response.data', JSON.stringify(response.data));
      
      console.log('Response from service-b:', response.data);
      
      res.status(200).json({
        success: true,
        message: 'Successfully called service-b',
        data: response.data,
        traceId: span.spanContext().traceId // Возвращаем traceId для отладки
      });
      
    } catch (error) {
      // Логируем ошибку в спане
      span.setAttribute('error', true);
      span.setAttribute('error.message', error.message);
      
      console.error('Error calling service-b:', error.message);
      
      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        traceId: span.spanContext().traceId
      });
      
    } finally {
      span.end();
    }
  });
});

// Простой health-check эндпоинт
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'service-a' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
  console.log(`OpenTelemetry is enabled`);
  console.log(`Endpoint: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});
