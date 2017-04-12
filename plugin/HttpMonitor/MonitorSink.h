#pragma once

#include <urlmon.h>

class CIEHostWindow;

namespace HttpMonitor 
{
	class MonitorSink:
		public PassthroughAPP::CInternetProtocolSinkWithSP<MonitorSink, CComMultiThreadModel>,
		public IHttpNegotiate
	{
		typedef PassthroughAPP::CInternetProtocolSinkWithSP<MonitorSink, CComMultiThreadModel> BaseClass;
	public:
		MonitorSink();
		~MonitorSink();

		BEGIN_COM_MAP(MonitorSink)
			COM_INTERFACE_ENTRY(IHttpNegotiate)
			COM_INTERFACE_ENTRY_CHAIN(BaseClass)
		END_COM_MAP()

		BEGIN_SERVICE_MAP(MonitorSink)
			SERVICE_ENTRY(IID_IHttpNegotiate)
			SERVICE_ENTRY(IID_IAuthenticate)
		END_SERVICE_MAP()

		//
		// IHttpNegotiate
		//

		STDMETHODIMP BeginningTransaction(
		LPCWSTR szURL,
		LPCWSTR szHeaders,
		DWORD dwReserved,
		LPWSTR *pszAdditionalHeaders);

		STDMETHODIMP OnResponse(
			DWORD dwResponseCode,
			LPCWSTR szResponseHeaders,
			LPCWSTR szRequestHeaders,
			LPWSTR *pszAdditionalRequestHeaders);
		
		//
		// IInternetProtocolSink
		//
		
		STDMETHODIMP ReportProgress(
			ULONG ulStatusCode,
			LPCWSTR szStatusText);

		STDMETHODIMP ReportResult( 
			HRESULT hrResult,
			DWORD dwError,
			LPCWSTR szResult);

		STDMETHODIMP ReportData( 
			DWORD grfBSCF,
			ULONG ulProgress,
			ULONG ulProgressMax);

		STDMETHODIMP Switch(PROTOCOLDATA *pProtocolData);

	private:
		// ������Ҫ���Ƶ� Headers ����ȥ
		void SetCustomHeaders(LPWSTR *pszAdditionalHeaders);

		/** �� HTTP Response Headers ��ɨ��� Cookies �����õ� Firefox �� */
		void ExportCookies(LPCWSTR szResponseHeaders);
		/** ��������� URL */
		CString m_strURL;
	};
}