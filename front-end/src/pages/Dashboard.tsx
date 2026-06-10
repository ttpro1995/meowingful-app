import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useSubscription } from '../graphql/client';
import {
  DASHBOARD_METRICS,
  DASHBOARD_METRICS_UPDATED,
} from '../graphql/queries';

const dateRangeOptions = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
] as const;

type DashboardRange = (typeof dateRangeOptions)[number]['value'];

interface ActivityEvent {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
}

interface DashboardMetricsResult {
  activeUsers: number;
  totalStudents: number;
  publishedCourses: number;
  monthlyRevenue: number;
  recentActivity: ActivityEvent[];
}

interface DashboardMetricsQuery {
  dashboardMetrics: DashboardMetricsResult;
}

interface DashboardMetricsUpdatedSubscription {
  dashboardMetricsUpdated: DashboardMetricsResult;
}

function formatEventLabel(eventType: string): string {
  switch (eventType) {
    case 'USER_JOINED':
      return 'User joined';
    case 'COURSE_PUBLISHED':
      return 'Course published';
    case 'LEAD_CONVERTED':
      return 'Lead converted';
    default:
      return eventType;
  }
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString();
}

export default function Dashboard() {
  const [selectedRange, setSelectedRange] =
    useState<DashboardRange>('LAST_30_DAYS');

  const { data, loading, error, refetch } = useQuery<DashboardMetricsQuery>(
    DASHBOARD_METRICS,
    {
      variables: { dateRange: { preset: selectedRange } },
      fetchPolicy: 'cache-and-network',
      pollInterval: 60_000,
    },
  );

  useSubscription<DashboardMetricsUpdatedSubscription>(
    DASHBOARD_METRICS_UPDATED,
    {
      variables: { dateRange: { preset: selectedRange } },
      onData: () => {
        void refetch();
      },
    },
  );

  const metrics = data?.dashboardMetrics;

  return (
    <div className="container dashboard-container">
      <div className="dashboard-header-row">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="dashboard-subtitle">
            Real-time tenant metrics with Redis-backed aggregation.
          </p>
        </div>
        <Link to="/profile" className="btn-secondary dashboard-back-link">
          Back to Profile
        </Link>
      </div>

      <div className="dashboard-filter-row">
        <label htmlFor="dashboard-date-range">Date range</label>
        <select
          id="dashboard-date-range"
          value={selectedRange}
          onChange={(event) =>
            setSelectedRange(event.target.value as DashboardRange)
          }
        >
          {dateRangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !metrics && <p>Loading dashboard metrics...</p>}

      {error && (
        <div className="error">
          {error.message ||
            'Unable to load dashboard metrics. You may not have access.'}
        </div>
      )}

      {metrics && (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h2>Active Users</h2>
              <p className="dashboard-value">{metrics.activeUsers}</p>
            </div>
            <div className="dashboard-card">
              <h2>Total Students</h2>
              <p className="dashboard-value">{metrics.totalStudents}</p>
            </div>
            <div className="dashboard-card">
              <h2>Courses Published</h2>
              <p className="dashboard-value">{metrics.publishedCourses}</p>
            </div>
            <div className="dashboard-card">
              <h2>Monthly Revenue</h2>
              <p className="dashboard-value">
                ${metrics.monthlyRevenue.toFixed(2)}
              </p>
              <p className="dashboard-note">Coming soon</p>
            </div>
          </div>

          <section className="profile-section">
            <h2>Recent Activity</h2>
            {metrics.recentActivity.length === 0 ? (
              <p className="dashboard-empty">No recent activity yet.</p>
            ) : (
              <ul className="dashboard-activity-list">
                {metrics.recentActivity.map((event) => (
                  <li key={event.id} className="dashboard-activity-item">
                    <div>
                      <strong>{formatEventLabel(event.type)}</strong>
                      <p>{event.actor}</p>
                    </div>
                    <time>{formatTimestamp(event.timestamp)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
