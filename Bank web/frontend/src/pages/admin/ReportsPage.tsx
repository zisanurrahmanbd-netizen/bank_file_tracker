import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DocumentArrowDownIcon,
  PlusIcon,
  EyeIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '@/services/apiClient';

interface Report {
  id: string;
  type: 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  startDate: string;
  endDate: string;
  format: 'XLSX' | 'CSV';
  parameters: any;
  filePath?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  bank?: {
    name: string;
    code: string;
  };
  requestedBy: {
    name: string;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  includeCollections: boolean;
  includeUpdates: boolean;
}

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [generateForm, setGenerateForm] = useState({
    bankId: '',
    reportType: 'WEEKLY' as 'WEEKLY' | 'MONTHLY' | 'CUSTOM',
    startDate: '',
    endDate: '',
    includeCollections: true,
    includeUpdates: false,
    format: 'XLSX' as 'XLSX' | 'CSV',
  });

  useEffect(() => {
    loadReports();
    loadTemplates();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/reports');
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await apiClient.get('/reports/templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      await apiClient.post('/reports/generate', generateForm);
      setShowGenerateModal(false);
      setGenerateForm({
        bankId: '',
        reportType: 'WEEKLY',
        startDate: '',
        endDate: '',
        includeCollections: true,
        includeUpdates: false,
        format: 'XLSX',
      });
      await loadReports();
      alert('Report generation started successfully');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const response = await apiClient.get(`/reports/${reportId}/download`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${reportId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to download report');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'GENERATING':
        return <ArrowPathIcon className="w-4 h-4 text-yellow-600 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
      case 'FAILED':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GENERATING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reports
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Generate and manage system reports
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadReports}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-porisheba-red-600 text-white rounded-xl hover:bg-porisheba-red-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              setGenerateForm({
                bankId: '',
                reportType: template.type as any,
                startDate: '',
                endDate: '',
                includeCollections: template.includeCollections,
                includeUpdates: template.includeUpdates,
                format: 'XLSX',
              });
              setShowGenerateModal(true);
            }}
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {template.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {template.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-porisheba-red-600 dark:text-porisheba-red-400 font-medium">
                {template.type}
              </span>
              <DocumentArrowDownIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Reports List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Reports ({reports.length})
          </h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-porisheba-red-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentArrowDownIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No reports generated yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {reports.map((report) => (
              <div key={report.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {report.type} Report
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {getStatusIcon(report.status)}
                        <span className="ml-1">{report.status}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        📅 {new Date(report.startDate).toLocaleDateString('bn-BD')} - {new Date(report.endDate).toLocaleDateString('bn-BD')}
                      </span>
                      <span>📄 {report.format}</span>
                      {report.bank && <span>🏦 {report.bank.name}</span>}
                      <span>👤 {report.requestedBy.name}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Created: {new Date(report.createdAt).toLocaleString('bn-BD')}
                      {report.completedAt && (
                        <> • Completed: {new Date(report.completedAt).toLocaleString('bn-BD')}</>
                      )}
                    </div>
                    
                    {report.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Error: {report.error}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {report.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleDownloadReport(report.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generate New Report
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Type
                </label>
                <select
                  value={generateForm.reportType}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, reportType: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={generateForm.startDate}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={generateForm.endDate}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Format
                </label>
                <select
                  value={generateForm.format}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, format: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="XLSX">Excel (.xlsx)</option>
                  <option value="CSV">CSV (.csv)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={generateForm.includeCollections}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, includeCollections: e.target.checked }))}
                    className="rounded border-gray-300 text-porisheba-red-600 focus:ring-porisheba-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Collections</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={generateForm.includeUpdates}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, includeUpdates: e.target.checked }))}
                    className="rounded border-gray-300 text-porisheba-red-600 focus:ring-porisheba-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Updates</span>
                </label>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating || !generateForm.startDate || !generateForm.endDate}
                className="flex-1 px-4 py-2 bg-porisheba-red-600 text-white rounded-xl hover:bg-porisheba-red-700 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
