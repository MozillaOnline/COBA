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
#pragma once

#include "resource.h"
#include "IECtrl.h"

namespace Plugin
{
	class CPlugin;
}

namespace HttpMonitor
{
	class MonitorSink;
}

namespace UserMessage
{
	// �Զ��崰����Ϣ
	static const UINT WM_USER_MESSAGE =  WM_USER + 200;

	// Sub-types of the user defined window message
	static const WPARAM WPARAM_SET_FIREFOX_COOKIE = 0;
	struct LParamSetFirefoxCookie
	{
		CString strURL;
		CString strCookie;
	};
}

// Firefox 4.0 ��ʼ�������µĴ��ڽṹ
// ���ڲ�����Ƿ��� GeckoPluginWindow �����������һ�� MozillaWindowClass���������Ƕ����
// MozillaWindowClass�����ǵ���ϢҪ�������㣬������дһ�����ҵĺ���
HWND GetTopMozillaWindowClassWindow(HWND hwndIECtrl);


// CIEHostWindow dialog

class CIEHostWindow : public CDialog
{
	DECLARE_DYNAMIC(CIEHostWindow)
	DECLARE_EVENTSINK_MAP()
	DECLARE_MESSAGE_MAP()

	friend class HttpMonitor::MonitorSink;

public:
	static CIEHostWindow* CreateNewIEHostWindow(DWORD dwId);

	/** ���� CIEHostWindow �� HWND Ѱ�Ҷ�Ӧ�� CIEHostWindow ���� */
	static CIEHostWindow* GetInstance(HWND hwnd);

	/** ���� URL Ѱ�Ҷ�Ӧ�� CIEHostWindow ���� */
	static CIEHostWindow* GetInstance(const CString& URL);

	/** ����Internet Explorer_Server�����ҵ���Ӧ�� CIEHostWindow ����*/
	static CIEHostWindow* FromInternetExplorerServer(HWND hwndIEServer);

	static void AddCookieIEWindow(CIEHostWindow *pWnd);

	static void SetFirefoxCookie(CString strURL, CString strCookie);
	static CString GetFirefoxUserAgent();
public:
	
	virtual ~CIEHostWindow();

	virtual BOOL CreateControlSite(COleControlContainer* pContainer, 
		COleControlSite** ppSite, UINT nID, REFCLSID clsid);

	// Dialog Data
	enum { IDD = IDD_IE_HOST_WINDOW };

	// Overrides
	virtual BOOL OnInitDialog();
	virtual BOOL DestroyWindow();

	/** ���ô��ڹ�����Plugin���� */
	void SetPlugin(Plugin::CPlugin* pPlugin) {m_pPlugin = pPlugin;}
protected:
	CIEHostWindow(Plugin::CPlugin* pPlugin = NULL, CWnd* pParent = NULL);   // standard constructor

	/** HWND�� CIEWindow �����ӳ��, ����ͨ�� HWND �����ҵ��Ѵ򿪵� CIEWindow ���� */
	static CSimpleMap<HWND, CIEHostWindow *> s_IEWindowMap;
	
	/** �� s_IEWindowMap ���ʹ�õ�, ��֤�̰߳�ȫ */
	static CCriticalSection s_csIEWindowMap;

	/** ID�� CIEWindow �����ӳ��, ����ͨ�� ID �����ҵ�������δʹ�õ� CIEWindow ���� */
	static CSimpleMap<DWORD, CIEHostWindow *> s_NewIEWindowMap;

	/** �� s_csNewIEWindowMap ���ʹ�õ�, ��֤�̰߳�ȫ */
	static CCriticalSection s_csNewIEWindowMap;

	/** ����ͬ��Cookie�� CIEHostWindow ���� */
	static CSimpleMap<HWND, CIEHostWindow *> s_CookieIEWindowMap;

	/** �� s_CookieIEWindowMap ���ʹ�õ�, ��֤�̰߳�ȫ */
	static CCriticalSection s_csCookieIEWindowMap;
	
	void InitIE();
	void UninitIE();

	// �������������Ƿ����
	BOOL IsOleCmdEnabled(OLECMDID cmdID);

	// ִ�����������
	void ExecOleCmd(OLECMDID cmdID);

	// �Զ��崰����Ϣ��Ӧ����
	void OnSetFirefoxCookie(const CString& strURL, const CString& strCookie);

	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support

	afx_msg void OnSize(UINT nType, int cx, int cy);
	afx_msg LRESULT OnUserMessage(WPARAM wParam, LPARAM lParam);
	void OnCommandStateChange(long Command, BOOL Enable);
	void OnStatusTextChange(LPCTSTR Text);
	void OnTitleChange(LPCTSTR Text);
	void OnProgressChange(long Progress, long ProgressMax);
	void OnBeforeNavigate2(LPDISPATCH pDisp, VARIANT* URL, VARIANT* Flags, VARIANT* TargetFrameName, VARIANT* PostData, VARIANT* Headers, BOOL* Cancel);
	void OnDocumentComplete(LPDISPATCH pDisp, VARIANT* URL);
	void OnNewWindow3Ie(LPDISPATCH* ppDisp, BOOL* Cancel, unsigned long dwFlags, LPCTSTR bstrUrlContext, LPCTSTR bstrUrl);

public:
	CIECtrl m_ie;

	/** ���ڼ��ص� URL. */
	CString m_strLoadingUrl;

	// plugin methods
	void Navigate(const CString& strURL, const CString& strPost, const CString& strHeaders);
	void Refresh();
	void Stop();
	void Back();
	void Forward();
	void Focus();
	void Copy();
	void Cut();
	void Paste();
	void SelectAll();
	void Find();
	void HandOverFocus();
	void Zoom(double level);
	void DisplaySecurityInfo();
	void SaveAs();
	void Print();
	void PrintPreview();
	void PrintSetup();

	// read only plugin properties
	CString GetURL();
	CString GetTitle();
	BOOL GetCanBack() {return m_bCanBack;}
	BOOL GetCanForward() {return m_bCanForward;}
	BOOL GetCanStop() {return IsOleCmdEnabled(OLECMDID_STOP);}
	BOOL GetCanRefresh() {return IsOleCmdEnabled(OLECMDID_REFRESH);}
	BOOL GetCanCopy(){return IsOleCmdEnabled(OLECMDID_COPY);}
	BOOL GetCanCut(){return IsOleCmdEnabled(OLECMDID_CUT);}
	BOOL GetCanPaste(){return IsOleCmdEnabled(OLECMDID_PASTE);}
	BOOL GetCanSelectAll(){return IsOleCmdEnabled(OLECMDID_SELECTALL);}
	INT32 GetProgress() {return m_iProgress;}
  CString GetFaviconURL();
  CString GetFaviconURLFromContent();
  CString m_strFaviconURL;

	// plugin events
	void OnTitleChanged(const CString& title);
	void OnProgressChanged(INT32 iProgress);
	void OnStatusChanged(const CString& message);
	void OnCloseIETab();

protected:
	BOOL m_bCanBack;
	BOOL m_bCanForward;
	INT32 m_iProgress;

	/** DIRTY FIX: NewWindow3 ���洴���� IE ���ڲ������� Referrer */
	CString m_strUrlContext;

	Plugin::CPlugin* m_pPlugin;
};
