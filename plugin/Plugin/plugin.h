/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
* Version: NPL 1.1/GPL 2.0/LGPL 2.1
*
* The contents of this file are subject to the Netscape Public License
* Version 1.1 (the "License"); you may not use this file except in
* compliance with the License. You may obtain a copy of the License at
* http://www.mozilla.org/NPL/
*
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*
* The Original Code is mozilla.org code.
*
* The Initial Developer of the Original Code is 
* Netscape Communications Corporation.
* Portions created by the Initial Developer are Copyright (C) 1998
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*
* Alternatively, the contents of this file may be used under the terms of
* either the GNU General Public License Version 2 or later (the "GPL"), or 
* the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
* in which case the provisions of the GPL or the LGPL are applicable instead
* of those above. If you wish to allow use of your version of this file only
* under the terms of either the GPL or the LGPL, and not to allow others to
* use your version of this file under the terms of the NPL, indicate your
* decision by deleting the provisions above and replace them with the notice
* and other provisions required by the GPL or the LGPL. If you do not delete
* the provisions above, a recipient may use your version of this file under
* the terms of any one of the NPL, the GPL or the LGPL.
*
* ***** END LICENSE BLOCK ***** */

#pragma once

#include "npapi.h"
#include "npruntime.h"
#include "PluginApp.h"
#include "pluginbase.h"

class CIEHostWindow;

namespace Plugin
{
	class CPlugin: public nsPluginBase
	{
	public: 
		// Overrides

		CPlugin(const nsPluginCreateData& data);
		~CPlugin();
		// ��ʼ��Plugin����
		NPBool init(NPWindow* pNPWindow);
		// ��Plugin���ڴ�С����λ�øı�ʱ, ͨ�� NPP_SetWindow ֪ͨ update
		NPError SetWindow(NPWindow* pNPWindow);
		// �ͷ�Plugin
		void shut();
		NPBool isInitialized();

	private: 
		CIEHostWindow* CreateIEHostWindow(HWND hParent, DWORD dwId);

	public:

		// ����Plugin״̬�ı�, ����Firefox��״̬������ʾ����
		void SetStatus(const CString& text);

		// ��ȡPlugin����ҳ���URL
		CString GetHostURL() const;

		CString GetNavigateParam(const NPUTF8* name) const;

		// ��ȡIECtrl::Navigate��Http headers����
		CString GetNavigateHeaders() const;

		// ��ȡIECtrl::Navigate��Post data����
		CString GetNavigatePostData() const;

		// ��ȡCIEHostWindow ID
		DWORD GetNavigateWindowId() const;

		// ���IECtrl::Navigate�Ĳ���
		void RemoveNavigateParams();

		NPObject *GetScriptableObject();

		/** This function is equivalent to the following JavaScript function:
		* function FireEvent(strEventType, strDetail) {
		*   var event = document.createEvent("CustomEvent");
		*   event.initCustomEvent(strEventType, true, true, strDetail);
		*   pluginObject.dispatchEvent(event);
		* }
		* 
		* Uses following JavaScript code to listen to the event fired:
		* pluginObject.addEventListener(strEventType, function(event) {
		*    alert(event.detail);
		* }
		*/
		BOOL FireEvent(const CString &strEventType, const CString &strDetail);

		/** ��ȡFirefox���ڷŴ�ϵ��
		*  ��Ӧ��JavaScript����ΪIMode.getZoomLevel()������ʡ����window��
		*  �����Ĵ��� window.IMode.getZoomLevel()
		*/
		double GetZoomLevel();

		/** ����Firefox��Cookie
		* @param strCookie Cookie�ַ���ֵ, ��ʽ�� cookie1=value1;cookie2=value2;cookie3=value3
		*/
		void SetURLCookie(const CString& strURL, const CString& strCookie);

		CString GetFirefoxUserAgent();

		/** ��һ����IE��ǩ, ʹ���Ѵ�����CIEHostWindow
		 * @param id CIEHostWindow ID
		 * @param strURL ��IE��ǩҳ��URL
		 */
		void NewIETab(DWORD id, const CString& strURL);

		/** �رյ�ǰ��IE��ǩ����*/
		void CloseIETab();

		/** ��Firefox����IE���ڱ���ı����Ϣ */
		void OnIeTitleChanged(const CString& strTitle);
	protected:

		NPP m_pNPInstance;

		HWND m_hWnd;

		CIEHostWindow *m_pIEHostWindow;

		NPStream * m_pNPStream;
		NPBool m_bInitialized;

		NPObject *m_pScriptableObject;

		// Plugin ID
		CString m_strId;
	};

}