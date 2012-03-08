#pragma once

#include "MonitorSink.h"

namespace HttpMonitor
{

	class HttpMonitorAPP;

	typedef PassthroughAPP::CustomSinkStartPolicy<HttpMonitorAPP, MonitorSink>
		HttpMonitorStartPolicy;

	/** �������coral ietab�����ڹ��˹��http��������û�н��й��ˣ����Խӿڲ�������*/
	class HttpMonitorAPP : public PassthroughAPP::CInternetProtocol<HttpMonitorStartPolicy>
	{
		typedef PassthroughAPP::CInternetProtocol<HttpMonitorStartPolicy> BaseClass;

	public:

		HttpMonitorAPP() {}

		~HttpMonitorAPP();

		// IInternetProtocolRoot
		STDMETHODIMP Start(
			/* [in] */ LPCWSTR szUrl,
			/* [in] */ IInternetProtocolSink *pOIProtSink,
			/* [in] */ IInternetBindInfo *pOIBindInfo,
			/* [in] */ DWORD grfPI,
			/* [in] */ HANDLE_PTR dwReserved);

		STDMETHODIMP Read(
			/* [in, out] */ void *pv,
			/* [in] */ ULONG cb,
			/* [out] */ ULONG *pcbRead);

		STDMETHODIMP Terminate(
			/* [in] */ DWORD dwOptions);

	public:

		HRESULT FinalConstruct();
	};

}