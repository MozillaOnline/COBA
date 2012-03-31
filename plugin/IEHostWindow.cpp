/*
This file is part of Fire-IE.

Fire-IE is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Fire-IE is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Fire-IE.  If not, see <http://www.gnu.org/licenses/>.
*/

// IEHostWindow.cpp : implementation file
//

#include "stdafx.h"
#include <mshtml.h>
#include <exdispid.h>
#include <comutil.h>
#include "IEControlSite.h"
#include "PluginApp.h"
#include "IEHostWindow.h"
#include "plugin.h"



CSimpleMap<HWND, CIEHostWindow *> CIEHostWindow::s_IEWindowMap;
CCriticalSection CIEHostWindow::s_csIEWindowMap; 
CSimpleMap<DWORD, CIEHostWindow *> CIEHostWindow::s_NewIEWindowMap;
CCriticalSection CIEHostWindow::s_csNewIEWindowMap;
CSimpleMap<HWND, CIEHostWindow *> CIEHostWindow::s_CookieIEWindowMap;
CCriticalSection CIEHostWindow::s_csCookieIEWindowMap;

// CIEHostWindow dialog

IMPLEMENT_DYNAMIC(CIEHostWindow, CDialog)

	CIEHostWindow::CIEHostWindow(Plugin::CPlugin* pPlugin /*=NULL*/, CWnd* pParent /*=NULL*/)
	: CDialog(CIEHostWindow::IDD, pParent)
	, m_pPlugin(pPlugin)
	, m_bCanBack(FALSE)
	, m_bCanForward(FALSE)
	, m_iProgress(-1)
{

}

CIEHostWindow::~CIEHostWindow()
{
}

/** ���� CIEHostWindow �� HWND Ѱ�Ҷ�Ӧ�� CIEHostWindow ���� */
CIEHostWindow* CIEHostWindow::GetInstance(HWND hwnd)
{
	CIEHostWindow *pInstance = NULL;
	s_csIEWindowMap.Lock();
	pInstance = s_IEWindowMap.Lookup(hwnd);
	s_csIEWindowMap.Unlock();
	return pInstance;
}

/** ���� URL Ѱ�Ҷ�Ӧ�� CIEHostWindow ���� */
CIEHostWindow* CIEHostWindow::GetInstance(const CString& URL)
{
	CIEHostWindow *pInstance = NULL;
	s_csIEWindowMap.Lock();
	for (int i=0; i<s_IEWindowMap.GetSize(); i++)
	{
		CIEHostWindow* p = s_IEWindowMap.GetValueAt(i);
		if (FuzzyUrlCompare( p->m_strLoadingUrl, URL))
		{
			pInstance = p;
			break;
		}
	}
	s_csIEWindowMap.Unlock();
	return pInstance;
}
/** ����Internet Explorer_Server�ҵ���Ӧ�� CIEHostWindow ����*/
CIEHostWindow* CIEHostWindow::FromInternetExplorerServer(HWND hwndIEServer)
{
	// Internet Explorer_Server ���������� plugin ����
	HWND hwnd = ::GetParent(::GetParent(::GetParent(hwndIEServer)));
	CString strClassName;
	GetClassName(hwnd, strClassName.GetBuffer(MAX_PATH), MAX_PATH);
	strClassName.ReleaseBuffer();
	if (strClassName != STR_WINDOW_CLASS_NAME)
	{
		return NULL;
	}

	// ��Window Long��ȡ��CIEHostWindow����ָ�� 
	CIEHostWindow* pInstance = reinterpret_cast<CIEHostWindow* >(::GetWindowLongPtrA(hwnd, GWLP_USERDATA));
	return pInstance;
}

CIEHostWindow* CIEHostWindow::CreateNewIEHostWindow(DWORD dwId)
{
	CIEHostWindow *pIEHostWindow = NULL;

	if (dwId != 0)
	{
		// ����ṩ��ID������˵��IEHostWindow�����Ѵ���������Ҫ���½���
		s_csNewIEWindowMap.Lock();
		pIEHostWindow = CIEHostWindow::s_NewIEWindowMap.Lookup(dwId);
		if (pIEHostWindow)
		{
			CIEHostWindow::s_NewIEWindowMap.Remove(dwId);
		}
		s_csNewIEWindowMap.Unlock();
	}
	else 
	{
		s_csNewIEWindowMap.Lock();
		pIEHostWindow = new CIEHostWindow();
		if (pIEHostWindow == NULL || !pIEHostWindow->Create(CIEHostWindow::IDD))
		{
			if (pIEHostWindow)
			{
				delete pIEHostWindow;
			}
			pIEHostWindow = NULL;
		}
		s_csNewIEWindowMap.Unlock();
	}
	return pIEHostWindow;
}

void CIEHostWindow::AddCookieIEWindow(CIEHostWindow *pWnd)
{
	s_csCookieIEWindowMap.Lock();
	s_CookieIEWindowMap.Add(pWnd->GetSafeHwnd(), pWnd);
	s_csCookieIEWindowMap.Unlock();
}

void CIEHostWindow::SetFirefoxCookie(CString strURL, CString strCookie)
{
	using namespace UserMessage;
	HWND hwnd = NULL;
	s_csCookieIEWindowMap.Lock();
	if (s_CookieIEWindowMap.GetSize() > 0)
	{
		hwnd = s_CookieIEWindowMap.GetValueAt(0)->GetSafeHwnd();
	}
	s_csCookieIEWindowMap.Unlock();
	if (hwnd)
	{
		LParamSetFirefoxCookie param = {strURL, strCookie};
		::SendMessage(hwnd, WM_USER_MESSAGE, WPARAM_SET_FIREFOX_COOKIE, reinterpret_cast<LPARAM>(&param));
	}
}

CString CIEHostWindow::GetFirefoxUserAgent()
{
	CString strUserAgent;
	CIEHostWindow *pIEHostWindow = NULL;
	s_csCookieIEWindowMap.Lock();
	if (s_CookieIEWindowMap.GetSize() > 0)
	{
		pIEHostWindow = s_CookieIEWindowMap.GetValueAt(0);
	}
	
	if (pIEHostWindow && pIEHostWindow->m_pPlugin)
	{
		strUserAgent = pIEHostWindow->m_pPlugin->GetFirefoxUserAgent();
	}
	s_csCookieIEWindowMap.Unlock();
	return strUserAgent;
}

BOOL CIEHostWindow::CreateControlSite(COleControlContainer* pContainer, 
	COleControlSite** ppSite, UINT nID, REFCLSID clsid)
{
	ASSERT(ppSite != NULL);
	*ppSite = new CIEControlSite(pContainer, this);
	return TRUE;
}

void CIEHostWindow::DoDataExchange(CDataExchange* pDX)
{
	CDialog::DoDataExchange(pDX);
	DDX_Control(pDX, IDC_IE_CONTROL, m_ie);
}


BEGIN_MESSAGE_MAP(CIEHostWindow, CDialog)
	ON_WM_SIZE()
	ON_MESSAGE(UserMessage::WM_USER_MESSAGE, OnUserMessage)
	ON_WM_PARENTNOTIFY()
END_MESSAGE_MAP()


// CIEHostWindow message handlers

BOOL CIEHostWindow::OnInitDialog()
{
	CDialog::OnInitDialog();

	InitIE();

	// ����CIEHostWindow����ָ�룬��BrowserHook::WindowMessageHook����ͨ��Window handle�ҵ���Ӧ��CIEHostWindow����
	::SetWindowLongPtr(GetSafeHwnd(), GWLP_USERDATA, reinterpret_cast<LONG>(this)); 

	return TRUE;  // return TRUE unless you set the focus to a control
}

void CIEHostWindow::InitIE()
{
	s_csIEWindowMap.Lock();
	s_IEWindowMap.Add(GetSafeHwnd(), this);
	s_csIEWindowMap.Unlock();

	// ����IE�ؼ���һЩ����, ��ϸ��Ϣ��MSDN��CoInternetSetFeatureEnabled Function
	INTERNETFEATURELIST features[] = {FEATURE_WEBOC_POPUPMANAGEMENT
		, FEATURE_WEBOC_POPUPMANAGEMENT		// ����IE�ĵ������ڹ���
		, FEATURE_SECURITYBAND				// ���غͰ�װ���ʱ��ʾ
		, FEATURE_LOCALMACHINE_LOCKDOWN		// ʹ��IE�ı��ذ�ȫ����(Apply Local Machine Zone security settings to all local content.)
		, FEATURE_SAFE_BINDTOOBJECT			// ActiveX���Ȩ�޵�����, ���幦�ܲ��꣬Coral IE Tab�������ѡ��
		, FEATURE_TABBED_BROWSING			// ���ö��ǩ���
	};			
	int n = sizeof(features) / sizeof(INTERNETFEATURELIST);
	for (int i=0; i<n; i++)
	{
		CoInternetSetFeatureEnabled(features[i], SET_FEATURE_ON_PROCESS, TRUE);
	}

	m_ie.put_RegisterAsBrowser(TRUE);

	// �������ק����������ڵ��ļ���
	m_ie.put_RegisterAsDropTarget(TRUE);
}


void CIEHostWindow::UninitIE()
{
	/**
	*  ����ҳ��ر�ʱIE�ؼ��Ľű�������ʾ
	*  ��Ȼ��CIEControlSite::XOleCommandTarget::Exec�Ѿ�������IE�ؼ��ű�������ʾ��
	*  ��IE Ctrl�ر�ʱ����ĳЩվ��(��map.baidu.com)�Ի���ʾ�ű�������ʾ; ������put_Silent
	*  ǿ�ƹر����е�����ʾ��
	*  ע�⣺������ҳ�����ʱ����put_Silent�������ͬʱ���β����װ����ʾ��
	*/
	m_ie.put_Silent(TRUE);

	s_csIEWindowMap.Lock();
	s_IEWindowMap.Remove(GetSafeHwnd());
	s_csIEWindowMap.Unlock();

	s_csCookieIEWindowMap.Lock();
	s_CookieIEWindowMap.Remove(GetSafeHwnd());
	s_csCookieIEWindowMap.Unlock();
}


void CIEHostWindow::OnSize(UINT nType, int cx, int cy)
{
	CDialog::OnSize(nType, cx, cy);

	if (m_ie.GetSafeHwnd())
	{
		m_ie.MoveWindow(0, 0, cx, cy);
	}
}

LRESULT CIEHostWindow::OnUserMessage(WPARAM wParam, LPARAM lParam)
{
	using namespace UserMessage;
	switch(wParam)
	{
	case WPARAM_SET_FIREFOX_COOKIE:
		{
			LParamSetFirefoxCookie* pData = reinterpret_cast<LParamSetFirefoxCookie*>(lParam);
			OnSetFirefoxCookie(pData->strURL, pData->strCookie);
		}
		break;
	}
	return 0;
}


BEGIN_EVENTSINK_MAP(CIEHostWindow, CDialog)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_COMMANDSTATECHANGE, CIEHostWindow::OnCommandStateChange, VTS_I4 VTS_BOOL)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_STATUSTEXTCHANGE  , CIEHostWindow::OnStatusTextChange, VTS_BSTR)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_TITLECHANGE       , CIEHostWindow::OnTitleChange, VTS_BSTR)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_PROGRESSCHANGE    , CIEHostWindow::OnProgressChange, VTS_I4 VTS_I4)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_BEFORENAVIGATE2   , CIEHostWindow::OnBeforeNavigate2, VTS_DISPATCH VTS_PVARIANT VTS_PVARIANT VTS_PVARIANT VTS_PVARIANT VTS_PVARIANT VTS_PBOOL)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_DOCUMENTCOMPLETE  , CIEHostWindow::OnDocumentComplete, VTS_DISPATCH VTS_PVARIANT)
	ON_EVENT(CIEHostWindow, IDC_IE_CONTROL, DISPID_NEWWINDOW3        , CIEHostWindow::OnNewWindow3Ie, VTS_PDISPATCH VTS_PBOOL VTS_UI4 VTS_BSTR VTS_BSTR)
END_EVENTSINK_MAP()


void CIEHostWindow::OnCommandStateChange(long Command, BOOL Enable)
{
	switch (Command)
	{
	case CSC_NAVIGATEBACK:
		m_bCanBack =  Enable;
		break;
	case CSC_NAVIGATEFORWARD:
		m_bCanForward = Enable;
		break;
	}
}

// Pack some data into a SAFEARRAY of BYTEs
HRESULT FillSafeArray(_variant_t &vDest, LPCSTR szSrc)
{
	HRESULT hr;
	LPSAFEARRAY psa;
	ULONG cElems = (ULONG)strlen(szSrc);
	LPSTR pPostData;

	psa = SafeArrayCreateVector(VT_UI1, 0, cElems);
	if (!psa)
	{
		return E_OUTOFMEMORY;
	}

	hr = SafeArrayAccessData(psa, (LPVOID*)&pPostData);
	memcpy(pPostData, szSrc, cElems);
	hr = SafeArrayUnaccessData(psa);

	vDest.vt = VT_ARRAY | VT_UI1;
	vDest.parray = psa;
	return NOERROR;
}

CString GetHostName(const CString& strHeaders)
{
	const CString HOST_HEADER(_T("Host:"));
	int start = strHeaders.Find(HOST_HEADER);
	if (start != -1) 
	{
		start += HOST_HEADER.GetLength();
		int stop = strHeaders.Find(_T("\r\n"), start);
		if (stop != -1)
		{
			int count = stop - start + 1;
			CString strHost = strHeaders.Mid(start, count).Trim();
			return strHost;
		}
	}
	return _T("");
}

CString GetHostFromUrl(const CString& strUrl)
{
	CString strHost(strUrl);
	int pos = strUrl.Find(_T("://"));
	if (pos != -1)
	{
		strHost.Delete(0, pos+3);

	}
	pos = strHost.Find(_T("/"));
	if (pos != -1)
	{
		strHost = strHost.Left(pos);
	}
	return strHost;
}


CString GetProtocolFromUrl(const CString& strUrl)
{
  int pos = strUrl.Find(_T("://"));
  if (pos != -1)
  {
    return strUrl.Left(pos);
  }
  return _T("http"); // Assume http
}

CString GetPathFromUrl(const CString& strUrl)
{
  CString strPath(strUrl);
  int pos = strUrl.Find(_T("://"));
  if (pos != -1)
  {
    strPath.Delete(0, pos+3);

  }
  pos = strPath.Find(_T('/'));
  if (pos != -1)
  {
    strPath = strPath.Mid(pos);
    pos = strPath.Find(_T('?'));
    if (pos != -1)
    {
      strPath = strPath.Left(pos);
    }
    pos = strPath.ReverseFind(_T('/'));
    // pos can't be -1 here
    strPath = strPath.Left(pos + 1);
  }
  else
  {
    strPath = _T("/");
  }
  return strPath;
}

CString GetURLRelative(const CString& baseURL, const CString relativeURL)
{
  if (relativeURL.Find(_T("://")) != -1)
  {
    // complete url, return immediately
    return relativeURL;
  }

  CString protocol = GetProtocolFromUrl(baseURL);
  CString host = GetHostFromUrl(baseURL);
  if (relativeURL.GetLength() && relativeURL[0] == _T('/'))
  {
    // root url
    return protocol + _T("://") + host + relativeURL;
  }
  else
  {
    CString path = GetPathFromUrl(baseURL);
    // relative url
    return protocol + _T("://") + host + path + relativeURL;
  }
}
void FetchCookie(const CString& strUrl, const CString& strHeaders)
{
	const CString COOKIE_HEADER(_T("Cookie:"));
	int start = strHeaders.Find(COOKIE_HEADER);
	if (start != -1) 
	{
		start += COOKIE_HEADER.GetLength();
		int stop = strHeaders.Find(_T("\r\n"), start);
		if (stop != -1)
		{
			int count = stop - start + 1;
			CString strCookie = strHeaders.Mid(start, count);
			CString strHost = GetHostName(strHeaders);
			if (strHost.IsEmpty()) 
			{
				strHost = GetHostFromUrl(strUrl);
			}
			InternetSetCookie(strHost, NULL, strCookie + _T(";Sat,01-Jan-2020 00:00:00 GMT"));
		}
	} 
}

/** @TODO ��strPost�е�Content-Type��Content-Length��Ϣ�ƶ���strHeaders�У�������ֱ��ȥ��*/
void CIEHostWindow::Navigate(const CString& strURL, const CString& strPost, const CString& strHeaders)
{
	m_strLoadingUrl = strURL;
	if (m_ie.GetSafeHwnd())
	{
		try
		{
			CString strHost = GetHostName(strHeaders);
			if (strHost.IsEmpty()) 
			{
				strHost = GetHostFromUrl(strURL);
			}

			FetchCookie(strURL, strHeaders);
			_variant_t vFlags(0l);
			_variant_t vTarget(_T(""));
			_variant_t vPost;
			_variant_t vHeader(strHeaders + _T("Cache-control: private\r\n")); 
			if (!strPost.IsEmpty()) 
			{
				// ȥ��postContent-Type��Content-Length������header��Ϣ
				int pos = strPost.Find(_T("\r\n\r\n"));

				CString strTrimed = strPost.Right(strPost.GetLength() - pos - 4);
				int size = WideCharToMultiByte(CP_ACP, 0, strTrimed, -1, 0, 0, 0, 0);
				char* szPostData = new char[size + 1];
				WideCharToMultiByte(CP_ACP, 0, strTrimed, -1, szPostData, size, 0, 0);
				FillSafeArray(vPost, szPostData);
			}
			m_ie.Navigate(strURL, &vFlags, &vTarget, &vPost, &vHeader);
		}
		catch(...)
		{
			TRACE(_T("CIEHostWindow::Navigate URL=%s failed!\n"), strURL);
		}
	}
}

void CIEHostWindow::Refresh()
{
	if (m_ie.GetSafeHwnd())
	{
		try
		{
			m_ie.Refresh();
		}
		catch(...)
		{
			TRACE(_T("CIEHostWindow::Refresh failed!\n"));
		}
	}
}

void CIEHostWindow::Stop()
{
	if (m_ie.GetSafeHwnd())
	{
		try
		{
			m_ie.Stop();
		}
		catch(...)
		{
			TRACE(_T("CIEHostWindow::Stop failed!\n"));
		}
	}
}

void CIEHostWindow::Back()
{
	if (m_ie.GetSafeHwnd() && m_bCanBack)
	{
		try
		{
			m_ie.GoBack();
		}
		catch(...)
		{
			TRACE(_T("CIEHostWindow::Back failed!\n"));
		}
	}
}

void CIEHostWindow::Forward()
{
	if (m_ie.GetSafeHwnd() && m_bCanForward)
	{
		try
		{
			m_ie.GoForward();
		}
		catch(...)
		{
			TRACE(_T("CIEHostWindow::Forward failed!\n"));
		}
	}
}

void CIEHostWindow::Focus()
{
	if (m_ie.GetSafeHwnd())
	{
		m_ie.SetFocus();
	}
}

void CIEHostWindow::Copy()
{
	ExecOleCmd(OLECMDID_COPY);
}

void CIEHostWindow::Cut()
{
	ExecOleCmd(OLECMDID_CUT);
}

void CIEHostWindow::Paste()
{
	ExecOleCmd(OLECMDID_PASTE);
}

void CIEHostWindow::SelectAll()
{
	ExecOleCmd(OLECMDID_SELECTALL);
}

void CIEHostWindow::Find()
{
	ExecOleCmd(OLECMDID_FIND);
}

// ����Ҫ����Ϣ���͵� MozillaContentWindow ���Ӵ��ڣ�����������ڽṹ�Ƚϸ��ӣ�Firefox/SeaMonkey������ͬ��
// Firefox ��������� OOPP Ҳ������һ������������ר��дһ�����ҵĺ���
HWND GetMozillaContentWindow(HWND hwndIECtrl)
{
	//�����������취����һ��ѭ�������ң�ֱ���ҵ� MozillaContentWindow Ϊֹ
	HWND hwnd = ::GetParent(hwndIECtrl);
	for ( int i = 0; i < 5; i++ )
	{
		hwnd = ::GetParent( hwnd );
		TCHAR szClassName[MAX_PATH];
		if ( GetClassName(::GetParent(hwnd), szClassName, ARRAYSIZE(szClassName)) > 0 )
		{
			if ( _tcscmp(szClassName, _T("MozillaContentWindowClass")) == 0 )
			{
				return hwnd;
			}
		}
	}

	return NULL;
}

// Firefox 4.0 ��ʼ�������µĴ��ڽṹ
// ���ڲ�����Ƿ��� GeckoPluginWindow �����������һ�� MozillaWindowClass���������Ƕ����
// MozillaWindowClass�����ǵ���ϢҪ�������㣬������дһ�����ҵĺ���
HWND GetTopMozillaWindowClassWindow(HWND hwndIECtrl)
{
	HWND hwnd = ::GetParent(hwndIECtrl);
	for ( int i = 0; i < 5; i++ )
	{
		HWND hwndParent = ::GetParent( hwnd );
		if ( NULL == hwndParent ) break;
		hwnd = hwndParent;
	}

	TCHAR szClassName[MAX_PATH];
	if ( GetClassName(hwnd, szClassName, ARRAYSIZE(szClassName)) > 0 )
	{
		if ( _tcscmp(szClassName, _T("MozillaWindowClass")) == 0 )
		{
			return hwnd;
		}
	}

	return NULL;
}

void CIEHostWindow::HandOverFocus()
{
	HWND hwndMessageTarget = GetMozillaContentWindow(m_hWnd);
	if (!hwndMessageTarget)
	{
		hwndMessageTarget = GetTopMozillaWindowClassWindow(m_hWnd);
	}

	if ( hwndMessageTarget != NULL )
	{
		::SetFocus(hwndMessageTarget);
	}
}

void CIEHostWindow::Zoom(double level)
{
	if (level <= 0.01)
		return;

	int nZoomLevel = (int)(level * 100 + 0.5);

	CComVariant vZoomLevel(nZoomLevel);

	// >= IE7
	try
	{
		m_ie.ExecWB(OLECMDID_OPTICAL_ZOOM, OLECMDEXECOPT_DONTPROMPTUSER, &vZoomLevel, NULL);
		return;
	}
	catch (...)
	{
		TRACE(_T("CIEHostWindow::Zoom failed!\n"));
	}

	// IE6
	try
	{
		// IE6 ֻ֧����������, ��СΪ0, ���Ϊ4, Ĭ��Ϊ2
		int nLegecyZoomLevel = (int)((level - 0.8) * 10 + 0.5);
		nLegecyZoomLevel = max(nLegecyZoomLevel, 0);
		nLegecyZoomLevel = min(nLegecyZoomLevel, 4);

		vZoomLevel.intVal = nLegecyZoomLevel;
		m_ie.ExecWB(OLECMDID_ZOOM, OLECMDEXECOPT_DONTPROMPTUSER, &vZoomLevel, NULL );
	}
	catch(...)
	{
		TRACE(_T("CIEHostWindow::Zoom failed!\n"));
	}
}

void CIEHostWindow::DisplaySecurityInfo()
{

}

void CIEHostWindow::SaveAs()
{
	ExecOleCmd(OLECMDID_SAVEAS);
}

void CIEHostWindow::Print()
{
	ExecOleCmd(OLECMDID_PRINT);
}

void CIEHostWindow::PrintPreview()
{
	ExecOleCmd(OLECMDID_PRINTPREVIEW);
}

void CIEHostWindow::PrintSetup()
{
	ExecOleCmd(OLECMDID_PAGESETUP);
}

CString CIEHostWindow::GetURL()
{
	CString url;
	try
	{
		if (m_ie.GetSafeHwnd())
		{
			url = m_ie.get_LocationURL();
		}
	}
	catch(...)
	{
		TRACE(_T("CIEHostWindow::GetURL failed!\n"));
	}
	return url;
}

CString CIEHostWindow::GetTitle()
{
	CString title;
	try
	{
		if (m_ie.GetSafeHwnd())
		{
			title = m_ie.get_LocationName();
		}
	}
	catch(...)
	{
		TRACE(_T("CIEHostWindow::GetTitle failed!\n"));
	}
	return title;
}


CString CIEHostWindow::GetFaviconURL()
{
  CString host, url, favurl;
  favurl = _T("");
  try
  {
    if (m_ie.GetSafeHwnd())
    {
      url = m_ie.get_LocationURL();
      // use page specified favicon, if exists
      // here we query favicon url directly from content before it is cached
      // and use the cached value thereafter
      CString contentFaviconURL;
      if (m_strFaviconURL == _T("NONE"))
        contentFaviconURL = GetFaviconURLFromContent();
      else
        contentFaviconURL = m_strFaviconURL;
      if (contentFaviconURL != _T(""))
      {
        return GetURLRelative(url, contentFaviconURL);
      }
      host = GetHostFromUrl(url);
      if (host != "")
      {
        CString protocol = GetProtocolFromUrl(url);
        if (protocol.MakeLower() != _T("http") && protocol.MakeLower() != _T("https")) {
          // force http/https protocols -- others are not supported for purpose of fetching favicons
          protocol = _T("http");
        }
        favurl = protocol + _T("://") + host + _T("/favicon.ico");
      }
    }
  }
  catch(...)
  {
    TRACE(_T("CIEHostWindow::GetURL failed!\n"));
  }
  // temporary return baidu's favicon url
  return favurl;
}
CString CIEHostWindow::GetFaviconURLFromContent()
{
  CString favurl = _T("");
  CComQIPtr<IDispatch> pDisp;
  pDisp.Attach(m_ie.get_Document());
  if (!pDisp)
  {
    return favurl;
  }
  CComQIPtr<IHTMLDocument2> pDoc = pDisp;
  if (!pDoc)
  {
    return favurl;
  }
  CComQIPtr<IHTMLElementCollection> elems;
  pDoc->get_all(&elems);
  if (!elems)
  {
    return favurl;
  }
  long length;
  if (FAILED(elems->get_length(&length)))
  {
    return favurl;
  }
  /** iterate over elements in the document */
  for (int i = 0; i < length; i++)
  {
    CComVariant index = i;
    CComQIPtr<IDispatch> pElemDisp;
    elems->item(index, index, &pElemDisp);
    if (!pElemDisp)
    {
      continue;
    }
    CComQIPtr<IHTMLElement> pElem = pElemDisp;
    if (!pElem)
    {
      continue;
    }

    CComBSTR bstrTagName;
    if (FAILED(pElem->get_tagName(&bstrTagName)))
    {
      continue;
    }

    CString strTagName = bstrTagName;
    strTagName.MakeLower();
    // to speed up, only parse elements before the body element
    if (strTagName == _T("body"))
    {
      break;
    }
    if (strTagName != _T("link"))
    {
      continue;
    }
    CComVariant vRel;
    if (FAILED(pElem->getAttribute(_T("rel"), 2, &vRel)))
    {
      continue;
    }
    CString rel(vRel);
    rel.MakeLower();
    if (rel == _T("shortcut icon") || rel == _T("icon"))
    {
      CComVariant vHref;
      if (SUCCEEDED(pElem->getAttribute(_T("href"), 2, &vHref)))
      {
        favurl = vHref;
        break; // Assume only one favicon link
      }
    }
  }
  return favurl;
}
BOOL CIEHostWindow::IsOleCmdEnabled(OLECMDID cmdID)
{
	try
	{
		if (m_ie.GetSafeHwnd())
		{
			long result = m_ie.QueryStatusWB(cmdID);
			return  (result & OLECMDF_ENABLED) != 0; 
		}
	}
	catch(...)
	{
		TRACE(_T("CIEHostWindow::IsOleCmdEnabled id=%d failed!\n"), cmdID);
	}
	return false;
}

void CIEHostWindow::ExecOleCmd(OLECMDID cmdID)
{
	try
	{
		if(m_ie.GetSafeHwnd() && 
			(m_ie.QueryStatusWB(cmdID) & OLECMDF_ENABLED))
		{
			m_ie.ExecWB(cmdID, 0, NULL, NULL);
		}
	}
	catch(...)
	{
		TRACE(_T("CIEHostWindow::ExecOleCmd id=%d failed!\n"), cmdID);
	}
}

void CIEHostWindow::OnSetFirefoxCookie(const CString& strURL, const CString& strCookie)
{
	if (m_pPlugin)
	{
		m_pPlugin->SetURLCookie(strURL, strCookie);
	}
}

void CIEHostWindow::OnTitleChanged(const CString& title)
{
	if (m_pPlugin)
	{
		m_pPlugin->OnIeTitleChanged(title);
	}
}

void CIEHostWindow::OnProgressChanged(INT32 iProgress)
{
	if (m_pPlugin)
	{
		CString strDetail;
		strDetail.Format(_T("%d"), iProgress);
		m_pPlugin->FireEvent(_T("IeProgressChanged"), strDetail);
	}
}

void CIEHostWindow::OnStatusChanged(const CString& message)
{
	if (m_pPlugin)
	{
		m_pPlugin->SetStatus(message);
	}
}

void CIEHostWindow::OnCloseIETab()
{
	if (m_pPlugin)
	{
		m_pPlugin->CloseIETab();
	}
}
void CIEHostWindow::OnStatusTextChange(LPCTSTR Text)
{
	OnStatusChanged(Text);
}


void CIEHostWindow::OnTitleChange(LPCTSTR Text)
{
	OnTitleChanged(Text);
}


void CIEHostWindow::OnProgressChange(long Progress, long ProgressMax)
{
	if (Progress == -1) 
		Progress = ProgressMax;
	if (ProgressMax > 0) 
		m_iProgress = (100 * Progress) / ProgressMax; 
	else 
		m_iProgress = -1;
	OnProgressChanged(m_iProgress);
}


void CIEHostWindow::OnBeforeNavigate2(LPDISPATCH pDisp, VARIANT* URL, VARIANT* Flags, VARIANT* TargetFrameName, VARIANT* PostData, VARIANT* Headers, BOOL* Cancel)
{
	COLE2T szURL(URL->bstrVal);
	m_strLoadingUrl = szURL;
}


void CIEHostWindow::OnDocumentComplete(LPDISPATCH pDisp, VARIANT* URL)
{
	m_iProgress = -1;
	OnProgressChanged(m_iProgress);

	// ��Firefox����������ҳ��
	if (m_pPlugin)
	{
    m_strFaviconURL = GetFaviconURLFromContent();
    m_pPlugin->OnLoadComplete();
		double level = m_pPlugin->GetZoomLevel();
		if (fabs(level - 1.0) > 0.01) 
		{
			Zoom(level);
		}
	}
}

BOOL CIEHostWindow::DestroyWindow()
{
	UninitIE();

	return CDialog::DestroyWindow();
}


/** 
*  ����֮����Ҫʹ��NewWindow3����ʹ��NewWindow2������ΪNewWindow3�ṩ��bstrUrlContext������
* �ò������������´����ӵ�referrer,һЩ��վͨ�����referrer����ֹ����
*/
void CIEHostWindow::OnNewWindow3Ie(LPDISPATCH* ppDisp, BOOL* Cancel, unsigned long dwFlags, LPCTSTR bstrUrlContext, LPCTSTR bstrUrl)
{
	if (m_pPlugin)
	{
		s_csNewIEWindowMap.Lock();

		CIEHostWindow* pIEHostWindow = new CIEHostWindow();
		if (pIEHostWindow && pIEHostWindow->Create(CIEHostWindow::IDD))
		{
			DWORD id = reinterpret_cast<DWORD>(pIEHostWindow);
			s_NewIEWindowMap.Add(id, pIEHostWindow);
			*ppDisp = pIEHostWindow->m_ie.get_Application();
			m_pPlugin->NewIETab(id, bstrUrl);
		}
		else
		{
			if (pIEHostWindow)
			{
				delete pIEHostWindow;
			}
			*Cancel = TRUE;
		}
		s_csNewIEWindowMap.Unlock();
	}
}