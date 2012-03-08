#include "StdAfx.h"
#include "PluginGlobal.h"
#include "HttpMonitorAPP.h"
#include "WindowMessageHook.h"
#include "AtlDepHook.h"
#include "OS.h"

namespace Plugin
{
	using namespace Utils;

	/** ���ڼ���HTTP��HTTPS����, ͬ��Cookie */
	CComPtr<IClassFactory> g_spCFHTTP;
	CComPtr<IClassFactory> g_spCFHTTPS;

	typedef PassthroughAPP::CMetaFactory<PassthroughAPP::CComClassFactoryProtocol, HttpMonitor::HttpMonitorAPP> MetaFactory;

	// global plugin initialization
	NPError NS_PluginInitialize()
	{
		// ����http��https����ͬ��cookie
		CComPtr<IInternetSession> spSession;
		HRESULT hret = S_OK;
		if (FAILED(CoInternetGetSession(0, &spSession, 0)) && spSession )
		{
			return NPERR_GENERIC_ERROR;
		}
		if (MetaFactory::CreateInstance(CLSID_HttpProtocol, &g_spCFHTTP) != S_OK)
		{
			return NPERR_GENERIC_ERROR;
		}
		if (spSession->RegisterNameSpace(g_spCFHTTP, CLSID_NULL, L"http", 0, 0, 0) != S_OK)
		{
			return NPERR_GENERIC_ERROR;
		}
		if (MetaFactory::CreateInstance(CLSID_HttpSProtocol, &g_spCFHTTPS) != S_OK)
		{
			return NPERR_GENERIC_ERROR;
		}
		if (spSession->RegisterNameSpace(g_spCFHTTPS, CLSID_NULL, L"https", 0, 0, 0) != S_OK)
		{
			return NPERR_GENERIC_ERROR;
		}
		if (!BrowserHook::WindowMessageHook::s_instance.Install())
		{
			return NPERR_GENERIC_ERROR;
		}

		if (OS::GetVersion() == OS::WIN7 || OS::GetVersion() == OS::VISTA)
		{
			BrowserHook::AtlDepHook::s_instance.Install();
		}

		return NPERR_NO_ERROR;
	}

	// global shutdown
	void NS_PluginShutdown()
	{
		// ȡ������http��https����
		CComPtr<IInternetSession> spSession;
		if (SUCCEEDED(CoInternetGetSession(0, &spSession, 0)) && spSession )
		{
			if (g_spCFHTTP)
			{
				spSession->UnregisterNameSpace(g_spCFHTTP, L"http");
				g_spCFHTTP.Release();
			}
			if (g_spCFHTTPS)
			{
				spSession->UnregisterNameSpace(g_spCFHTTPS, L"https");
				g_spCFHTTPS.Release();
			}
		}
		if (OS::GetVersion() == OS::WIN7 || OS::GetVersion() == OS::VISTA)
		{
			BrowserHook::AtlDepHook::s_instance.Uninstall();
		}
		BrowserHook::WindowMessageHook::s_instance.Uninstall();
	}
}