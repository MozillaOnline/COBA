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

// PluginApp.h : main header file for the plugin DLL
//

#pragma once

#ifndef __AFXWIN_H__
	#error "include 'stdafx.h' before including this file for PCH"
#endif

#include "resource.h"		// main symbols

#define STR_WINDOW_CLASS_NAME	_T("COBA")	// CIEHostWindow��������

/** ��CStringת��ΪUTF8�ַ�����
 *  ʹ����Ϻ������delete[]�ͷ��ַ���
 */
char* CStringToUTF8String(const CString &str);

/** ��UTF8�ַ���תΪCString*/
CString UTF8ToCString(const char* szUTF8);

// CPluginApp
// See PluginApp.cpp for the implementation of this class
//

/**
* ģ��ƥ������ URL.
* http://my.com/path/file.html#123 �� http://my.com/path/file.html ����Ϊ��ͬһ�� URL
* http://my.com/path/query?p=xyz �� http://my.com/path/query ����Ϊ��ͬһ�� URL
*/
BOOL FuzzyUrlCompare (LPCTSTR lpszUrl1, LPCTSTR lpszUrl2);

class CPluginApp : public CWinApp
{
public:
	CPluginApp();

// Overrides
public:
	virtual BOOL InitInstance();

	DECLARE_MESSAGE_MAP()
  virtual int ExitInstance();
};
