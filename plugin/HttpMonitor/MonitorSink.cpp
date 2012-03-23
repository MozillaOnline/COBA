#include "StdAfx.h"
#include <Wininet.h>
#include <string>
#pragma comment(lib, "Wininet.lib")

#include "plugin.h"
#include "IEHostWindow.h"
#include "MonitorSink.h"
#include "PluginApp.h"
#include "ScriptablePluginObject.h"
#include "URI.h"

using namespace Utils;
namespace HttpMonitor
{
	// ���� \0 �ָ��� Raw HTTP Header ����ת������ \r\n �ָ��� Header
	void HttpRawHeader2CrLfHeader(LPCSTR szRawHeader, CString & strCrLfHeader)
	{
		strCrLfHeader.Empty();

		LPCSTR p = szRawHeader;
		while ( p[0] )
		{
			CString strHeaderLine(p);

			p += strHeaderLine.GetLength() + 1;

			strCrLfHeader += strHeaderLine + _T("\r\n");
		}
	}


	// @todo ��ʲô�ã�
	LPWSTR ExtractFieldValue(LPCWSTR szHeader, LPCWSTR szFieldName, LPWSTR * pFieldValue, size_t * pSize )
	{
		LPWSTR r = NULL;

		do 
		{
			// ���� RFC2616 �涨, HTTP field name �����ִ�Сд
			LPWSTR pStart = StrStrIW( szHeader, szFieldName );
			if ( ! pStart ) break;
			pStart += wcslen(szFieldName);
			while ( L' ' == pStart[0] ) pStart++;		// ������ͷ�Ŀո�
			LPWSTR pEnd = StrStrW( pStart, L"\r\n" );
			if ( ( ! pEnd ) || ( pEnd <= pStart ) ) break;

			size_t nSize = pEnd - pStart;
			size_t nBufLen = nSize + 2;		// �����ַ����� 0 ������
			LPWSTR lpBuffer = (LPWSTR)VirtualAlloc( NULL, nBufLen * sizeof(WCHAR), MEM_COMMIT, PAGE_READWRITE );
			if ( !lpBuffer ) break;

			if (wcsncpy_s( lpBuffer, nBufLen, pStart, nSize))
			{
				VirtualFree( lpBuffer, 0, MEM_RELEASE);
				break;
			}

			* pSize = nBufLen;
			* pFieldValue = lpBuffer;
			r = pEnd;

		} while(false);

		return r;
	}

	MonitorSink::MonitorSink()
	{
	}

	MonitorSink::~MonitorSink()
	{
	}

	STDMETHODIMP MonitorSink::BeginningTransaction(
		LPCWSTR szURL,
		LPCWSTR szHeaders,
		DWORD dwReserved,
		LPWSTR *pszAdditionalHeaders)
	{
		if (pszAdditionalHeaders)
		{
			*pszAdditionalHeaders = NULL;
		}

		// �ȵ���Ĭ�ϵ� IHttpNegotiate ����ӿ�, ��Ϊ����֮�� pszAdditionalHeaders �Ż��� Referer ����Ϣ
		CComPtr<IHttpNegotiate> spHttpNegotiate;
		QueryServiceFromClient(&spHttpNegotiate);
		HRESULT hr = spHttpNegotiate ?
			spHttpNegotiate->BeginningTransaction(szURL, szHeaders,
			dwReserved, pszAdditionalHeaders) :
		E_UNEXPECTED;

		m_strURL = szURL;
		SetCustomHeaders(pszAdditionalHeaders);

		return hr;
	}

	void MonitorSink::SetCustomHeaders(LPWSTR *pszAdditionalHeaders)
	{
		if (pszAdditionalHeaders)
		{
			USES_CONVERSION;

			CString strHeaders(W2T(*pszAdditionalHeaders));

			//static const BOOL SYNC_USER_AGENT = TRUE;
      URI uri(m_strURL);
      CString host(uri.getHost());
		  if (host.Find(_T("taobao.com")) == 0 || host.Find(_T("mail.sina.com")) == 0)
			{
				// ���� User-Agent
				CString strUserAgent;
				strUserAgent.Format(_T("User-Agent: %s\r\n"), CIEHostWindow::GetFirefoxUserAgent());

				strHeaders += strUserAgent;

				size_t nLen = strHeaders.GetLength() + 2;
				if (*pszAdditionalHeaders = (LPWSTR)CoTaskMemRealloc(*pszAdditionalHeaders, nLen*sizeof(WCHAR)))
				{
					int cnt = strHeaders.GetLength() + 1;
					TCHAR* tstr = new TCHAR[cnt];
					_tcsncpy_s(tstr, cnt, strHeaders, cnt);
					wcscpy_s(*pszAdditionalHeaders, nLen, T2W(tstr));
          delete [] tstr;
				}
			}
		}
	}

	STDMETHODIMP MonitorSink::OnResponse(
		DWORD dwResponseCode,
		LPCWSTR szResponseHeaders,
		LPCWSTR szRequestHeaders,
		LPWSTR *pszAdditionalRequestHeaders)
	{
		if (pszAdditionalRequestHeaders)
		{
			*pszAdditionalRequestHeaders = 0;
		}

		CComPtr<IHttpNegotiate> spHttpNegotiate;
		QueryServiceFromClient(&spHttpNegotiate);
		HRESULT hr = spHttpNegotiate ?
			spHttpNegotiate->OnResponse(dwResponseCode, szResponseHeaders,
			szRequestHeaders, pszAdditionalRequestHeaders) :
		E_UNEXPECTED;

		if ((dwResponseCode >= 200 ) && (dwResponseCode < 300))
		{
			// �����ﵼ�� Cookies, ���ܻ��а�ȫ������, ��һЩ������ Cookie Policy �� Cookie Ҳ�Ź�ȥ
			// ReportProgress() ���濴�ĵ��и� BINDSTATUS_SESSION_COOKIES_ALLOWED, �о�Ҫ����ȫһЩ, ����ʵ������ʱһֱû�е������״̬
			// Ҳ�� Firefox �Լ��ᴦ��
			ExportCookies(szResponseHeaders);
		}
		return hr;
	}

	void MonitorSink::ExportCookies(LPCWSTR szResponseHeaders)
	{
		static const WCHAR SET_COOKIE_HEAD [] = L"\r\nSet-Cookie:";

		LPWSTR p = (LPWSTR)szResponseHeaders;
		LPWSTR lpCookies = NULL;
		size_t nCookieLen = 0;
		while (p = ExtractFieldValue(p, SET_COOKIE_HEAD, &lpCookies, & nCookieLen))
		{
			if (lpCookies)
			{
				// TODO ȥ��m_strURL�������
				CString strCookie((LPCTSTR)CW2T(lpCookies));
				TRACE(_T("[ExportCookies] URL: %s  Cookie: %s"), m_strURL, strCookie);
				CIEHostWindow::SetFirefoxCookie(m_strURL, strCookie);
				VirtualFree(lpCookies, 0, MEM_RELEASE);
				lpCookies = NULL;
				nCookieLen = 0;
			}

		}
	}

	STDMETHODIMP MonitorSink::ReportProgress(
		ULONG ulStatusCode,
		LPCWSTR szStatusText)
	{
		HRESULT hr = m_spInternetProtocolSink ?
			m_spInternetProtocolSink->ReportProgress(ulStatusCode, szStatusText) :
		E_UNEXPECTED;
		switch ( ulStatusCode )
		{
			// �ض�����, ���¼�¼�� URL
		case BINDSTATUS_REDIRECTING:
			{
				// �ܶ���վ��¼��ʱ�����302��תʱ����Cookie, ����Gmail, ��������������ҲҪ���� Cookie
				CComPtr<IWinInetHttpInfo> spWinInetHttpInfo;
				if ( SUCCEEDED(m_spTargetProtocol->QueryInterface(&spWinInetHttpInfo)) && spWinInetHttpInfo )
				{
					CHAR szRawHeader[8192];		// IWinInetHttpInfo::QueryInfo() ���ص� Raw Header ���� Unicode ��
					DWORD dwBuffSize = ARRAYSIZE(szRawHeader);

					if ( SUCCEEDED(spWinInetHttpInfo->QueryInfo(HTTP_QUERY_RAW_HEADERS, szRawHeader, &dwBuffSize, 0, NULL)) )
					{
						// ע�� HTTP_QUERY_RAW_HEADERS ���ص� Raw Header �� \0 �ָ���, �� \0\0 ��Ϊ����, ��������Ҫ��ת��
						CString strHeader;
						HttpRawHeader2CrLfHeader(szRawHeader, strHeader);

						ExportCookies(strHeader);
					}
				}
			}
			break;
		}
		return hr;
	}

	STDMETHODIMP MonitorSink::ReportResult( 
		HRESULT hrResult,
		DWORD dwError,
		LPCWSTR szResult)
	{
		HRESULT hr = m_spInternetProtocolSink ?
				m_spInternetProtocolSink->ReportResult(hrResult, dwError, szResult):
				E_UNEXPECTED;
		return hr;
	}

	STDMETHODIMP MonitorSink::ReportData( 
		DWORD grfBSCF,
		ULONG ulProgress,
		ULONG ulProgressMax)
	{
		HRESULT hr = m_spInternetProtocolSink ?
				m_spInternetProtocolSink->ReportData(grfBSCF, ulProgress, ulProgressMax):
				E_UNEXPECTED;
		return hr;
	}

	STDMETHODIMP MonitorSink::Switch(PROTOCOLDATA *pProtocolData)
	{
		HRESULT hr = m_spInternetProtocolSink ?
			m_spInternetProtocolSink->Switch(pProtocolData) :
			E_UNEXPECTED;
		return hr;
	}
}