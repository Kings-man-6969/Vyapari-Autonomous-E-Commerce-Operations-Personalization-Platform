"""
Prometheus Metrics Registry and Collector for Vyapari Seller Agent.
Generates standard Prometheus exposition text format (version 0.0.4).
"""
import time
import threading
from typing import Dict, List, Tuple

# Histogram buckets for HTTP request duration (seconds)
DURATION_BUCKETS = (0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)


class PrometheusMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        
        # Counters: key -> int
        self.http_requests_total: Dict[Tuple[str, str, int], int] = {}  # (method, endpoint, status_code) -> count
        self.gemini_requests_total: int = 0
        self.gemini_errors_total: int = 0
        self.gemini_retries_total: int = 0
        self.quota_rejections_total: int = 0
        self.celery_tasks_total: Dict[str, int] = {}  # task_name -> count
        self.celery_task_failures_total: Dict[str, int] = {}  # task_name -> count
        
        # Duration Histograms: (method, endpoint) -> [bucket_counts, sum, count]
        self.http_duration_buckets: Dict[Tuple[str, str], List[int]] = {}
        self.http_duration_sum: Dict[Tuple[str, str], float] = {}
        self.http_duration_count: Dict[Tuple[str, str], int] = {}

    def inc_http_request(self, method: str, endpoint: str, status_code: int, duration_seconds: float):
        with self._lock:
            # Counter
            key = (method, endpoint, status_code)
            self.http_requests_total[key] = self.http_requests_total.get(key, 0) + 1
            
            # Histogram
            hist_key = (method, endpoint)
            if hist_key not in self.http_duration_buckets:
                self.http_duration_buckets[hist_key] = [0] * len(DURATION_BUCKETS)
                self.http_duration_sum[hist_key] = 0.0
                self.http_duration_count[hist_key] = 0
            
            for idx, bound in enumerate(DURATION_BUCKETS):
                if duration_seconds <= bound:
                    self.http_duration_buckets[hist_key][idx] += 1
            
            self.http_duration_sum[hist_key] += duration_seconds
            self.http_duration_count[hist_key] += 1

    def inc_gemini_request(self):
        with self._lock:
            self.gemini_requests_total += 1

    def inc_gemini_error(self):
        with self._lock:
            self.gemini_errors_total += 1

    def inc_gemini_retry(self):
        with self._lock:
            self.gemini_retries_total += 1

    def inc_quota_rejection(self):
        with self._lock:
            self.quota_rejections_total += 1

    def inc_celery_task(self, task_name: str, failed: bool = False):
        with self._lock:
            self.celery_tasks_total[task_name] = self.celery_tasks_total.get(task_name, 0) + 1
            if failed:
                self.celery_task_failures_total[task_name] = self.celery_task_failures_total.get(task_name, 0) + 1

    def export_prometheus_text(self) -> str:
        """Renders all metrics in standard Prometheus exposition format."""
        with self._lock:
            lines = []

            # 1. http_requests_total
            lines.append("# HELP seller_agent_http_requests_total Total HTTP requests handled by seller agent API.")
            lines.append("# TYPE seller_agent_http_requests_total counter")
            if not self.http_requests_total:
                lines.append('seller_agent_http_requests_total{method="GET",endpoint="/health",status="200"} 0')
            else:
                for (method, ep, status), count in sorted(self.http_requests_total.items()):
                    lines.append(f'seller_agent_http_requests_total{{method="{method}",endpoint="{ep}",status="{status}"}} {count}')

            # 2. http_request_duration_seconds
            lines.append("# HELP seller_agent_http_request_duration_seconds Latency histogram for HTTP requests.")
            lines.append("# TYPE seller_agent_http_request_duration_seconds histogram")
            for hist_key, buckets in sorted(self.http_duration_buckets.items()):
                method, ep = hist_key
                cum = 0
                for idx, bound in enumerate(DURATION_BUCKETS):
                    cum += buckets[idx]
                    lines.append(f'seller_agent_http_request_duration_seconds_bucket{{method="{method}",endpoint="{ep}",le="{bound}"}} {cum}')
                total_cnt = self.http_duration_count[hist_key]
                lines.append(f'seller_agent_http_request_duration_seconds_bucket{{method="{method}",endpoint="{ep}",le="+Inf"}} {total_cnt}')
                lines.append(f'seller_agent_http_request_duration_seconds_sum{{method="{method}",endpoint="{ep}"}} {self.http_duration_sum[hist_key]:.6f}')
                lines.append(f'seller_agent_http_request_duration_seconds_count{{method="{method}",endpoint="{ep}"}} {total_cnt}')

            # 3. Gemini metrics
            lines.append("# HELP seller_agent_gemini_requests_total Total calls made to Google Gemini API.")
            lines.append("# TYPE seller_agent_gemini_requests_total counter")
            lines.append(f"seller_agent_gemini_requests_total {self.gemini_requests_total}")

            lines.append("# HELP seller_agent_gemini_errors_total Total errors encountered calling Gemini API.")
            lines.append("# TYPE seller_agent_gemini_errors_total counter")
            lines.append(f"seller_agent_gemini_errors_total {self.gemini_errors_total}")

            lines.append("# HELP seller_agent_gemini_retries_total Total retry attempts executed with exponential backoff.")
            lines.append("# TYPE seller_agent_gemini_retries_total counter")
            lines.append(f"seller_agent_gemini_retries_total {self.gemini_retries_total}")

            # 4. Quota metrics
            lines.append("# HELP seller_agent_quota_rejections_total Total requests rejected due to quota exhaustion (HTTP 429).")
            lines.append("# TYPE seller_agent_quota_rejections_total counter")
            lines.append(f"seller_agent_quota_rejections_total {self.quota_rejections_total}")

            # 5. Celery metrics
            lines.append("# HELP seller_agent_celery_tasks_total Total Celery tasks executed.")
            lines.append("# TYPE seller_agent_celery_tasks_total counter")
            if not self.celery_tasks_total:
                lines.append('seller_agent_celery_tasks_total{task="none"} 0')
            else:
                for task_name, count in sorted(self.celery_tasks_total.items()):
                    lines.append(f'seller_agent_celery_tasks_total{{task="{task_name}"}} {count}')

            lines.append("# HELP seller_agent_celery_task_failures_total Total Celery task failures.")
            lines.append("# TYPE seller_agent_celery_task_failures_total counter")
            if not self.celery_task_failures_total:
                lines.append('seller_agent_celery_task_failures_total{task="none"} 0')
            else:
                for task_name, count in sorted(self.celery_task_failures_total.items()):
                    lines.append(f'seller_agent_celery_task_failures_total{{task="{task_name}"}} {count}')

            return "\n".join(lines) + "\n"


# Singleton metrics registry
metrics = PrometheusMetrics()
