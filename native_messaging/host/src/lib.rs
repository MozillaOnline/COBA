/*
 * Based on
 * https://support.microsoft.com/kb/167658 and
 * https://github.com/Microsoft/Windows-classic-samples/blob/8f31b1ff79d6/
 *     Samples/Win7Samples/multimedia/mediafoundation/protectedplayback/WebHelper.cpp
 */

extern crate advapi32;
extern crate ole32;
extern crate oleaut32;
#[macro_use(DEFINE_GUID, ENUM, RIDL)]
extern crate winapi;

mod iwebbrowser2;

use std::{cmp, ffi, fmt, ptr};
use std::os::windows::ffi::OsStrExt;

use advapi32::{RegCloseKey, RegDeleteTreeW, RegOpenKeyExW};
use ole32::{CoCreateInstance, CoInitialize, CoUninitialize};
// oleaut32 patched to enable necessary SafeArray* and Variant*
use oleaut32::{SafeArrayAccessData, SafeArrayCreateVector, SafeArrayUnaccessData,
    SysAllocString, SysFreeString, VariantClear, VariantInit};
// ERROR_FILE_NOT_FOUND & ERROR_SUCCESS should be LONG? not sure why they are DWORD here
use winapi::{CLSCTX_SERVER, HKEY_CURRENT_USER,
    KEY_ENUMERATE_SUB_KEYS, KEY_QUERY_VALUE, KEY_SET_VALUE, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    ERROR_FILE_NOT_FOUND, ERROR_SUCCESS, E_OUTOFMEMORY, NOERROR, SUCCEEDED,
    DWORD, HKEY, LPSTR, REGSAM, VARENUM, VT_ARRAY, VT_BSTR, VT_UI1};
use iwebbrowser2::{BSTR, HRESULT, LONG, VARIANT,
    CLSID_InternetExplorer, IID_IWebBrowser2, IWebBrowser2, VARIANT_TRUE};

struct WindowSize {
    height: LONG,
    width: LONG
}

impl fmt::Display for WindowSize {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}x{}", self.width, self.height)
    }
}

fn str_to_wstr(input: &str) -> Vec<u16> {
    ffi::OsStr::new(input).encode_wide().chain(Some(0)).collect()
}

// ffi related ownership concerns?
fn remove_hkcu_clsid_ie(registry_node: REGSAM) {
    let sub_key = str_to_wstr("SOFTWARE\\Classes\\CLSID");
    // is this the minimal necessary samDesired ? what about DELETE ?
    let sam_desired = KEY_ENUMERATE_SUB_KEYS | KEY_QUERY_VALUE | KEY_SET_VALUE | registry_node;
    let mut hkey: HKEY = ptr::null_mut();

    match unsafe {
        RegOpenKeyExW(HKEY_CURRENT_USER, sub_key.as_ptr(), 0, sam_desired, &mut hkey)
    } as DWORD {
        ERROR_SUCCESS => (),
        ret           => eprintln!("RegOpenKeyExW returns: {}", ret),
    };

    if hkey.is_null() {
        return;
    }

    // hard-coded, no stringFromCLSID yet
    let sub_key = str_to_wstr("{0002DF01-0000-0000-C000-000000000046}");
    match unsafe { RegDeleteTreeW(hkey, sub_key.as_ptr()) } as DWORD {
        ERROR_FILE_NOT_FOUND => (),
        ERROR_SUCCESS        => eprintln!("RegDeleteTreeW succeeded"),
        ret                  => eprintln!("RegDeleteTreeW returns: {}", ret),
    };

    match unsafe { RegCloseKey(hkey) } as DWORD {
        ERROR_SUCCESS => (),
        ret           => eprintln!("RegCloseKey returns: {}", ret),
    };
}

fn init_web_browser(p_web_browser: &mut *mut IWebBrowser2) -> HRESULT {
    let hr = unsafe {
        CoCreateInstance(&CLSID_InternetExplorer,
            ptr::null_mut(),
            CLSCTX_SERVER,
            &IID_IWebBrowser2,
            // p_web_browser as *mut *mut IWebBrowser2 as *mut LPVOID)
            p_web_browser as *mut _ as *mut _)
    };
    if SUCCEEDED(hr) {
        // eprintln!("p_web_browser: {:p}", p_web_browser);
    } else {
        eprintln!("CoCreateInstance result: {:#x}", hr);
    }
    hr
}

fn init_bstr(output: &mut BSTR, input: &str) -> HRESULT {
    let bstr = unsafe { SysAllocString(str_to_wstr(input).as_ptr()) };
    if bstr.is_null() {
        E_OUTOFMEMORY
    } else {
        *output = bstr;
        // eprintln!("bstr: {:p}", bstr);
        NOERROR
    }
}

fn init_vt_data(output: &mut VARIANT, input: &str) -> HRESULT {
    let bytes_data = input.as_bytes();
    let byte_count = bytes_data.len();

    let VARENUM(vt_array) = VT_ARRAY;
    let VARENUM(vt_ui1) = VT_UI1;

    // VARTYPE, ULONG
    let psa = unsafe { SafeArrayCreateVector(vt_ui1 as _, 0, byte_count as _) };
    let mut hr = if psa.is_null() {
        E_OUTOFMEMORY
    } else {
        NOERROR
    };

    let mut p_data: LPSTR = ptr::null_mut();
    if SUCCEEDED(hr) {
        // &mut p_data as *mut LPSTR as *mut LPVOID
        hr = unsafe { SafeArrayAccessData(psa, &mut p_data as *mut _ as *mut _) };
    }

    if SUCCEEDED(hr) {
        hr = unsafe {
            ptr::copy_nonoverlapping(bytes_data.as_ptr() as LPSTR, p_data, byte_count);
            SafeArrayUnaccessData(psa)
        };
    };

    if SUCCEEDED(hr) {
        output.data0 = (vt_array | vt_ui1) as u64;
        // u32 or u64 depends on target platform
        output.data1 = psa as _;
    }

    hr
}

pub fn navigate_ie_with(url: &str, body: &str, headers: &str) -> Result<HRESULT, HRESULT> {
    remove_hkcu_clsid_ie(KEY_WOW64_32KEY);
    remove_hkcu_clsid_ie(KEY_WOW64_64KEY);

    let mut hr = unsafe { CoInitialize(ptr::null_mut()) };

    let mut p_web_browser: *mut IWebBrowser2 = ptr::null_mut();
    if SUCCEEDED(hr) {
        hr = init_web_browser(&mut p_web_browser);
    } else {
        eprintln!("CoInitialize result: {:#x}", hr);
    }

    let mut vt_empty = VARIANT { data0: 0, data1: 0, data2: 0 };
    let mut vt_data = vt_empty;
    let mut vt_headers = vt_empty;

    unsafe {
        VariantInit(&mut vt_empty);
        VariantInit(&mut vt_data);
        VariantInit(&mut vt_headers);
    };

    let mut bstr_url: BSTR = ptr::null_mut();
    if SUCCEEDED(hr) {
        hr = init_bstr(&mut bstr_url, url);
    }

    let mut bstr_headers: BSTR = ptr::null_mut();
    if SUCCEEDED(hr) {
        hr = init_bstr(&mut bstr_headers, headers);
    }

    if SUCCEEDED(hr) {
        let VARENUM(vt_bstr) = VT_BSTR;
        vt_headers.data0 = vt_bstr as u64;
        // u32 or u64 depends on target platform
        vt_headers.data1 = bstr_headers as _;
    }

    if SUCCEEDED(hr) {
        if !body.is_empty() {
            hr = init_vt_data(&mut vt_data, body);
        }
    }

    if SUCCEEDED(hr) {
        // eprintln!("url: {:p}, vt_data: {}, vt_headers: {}",
        //     bstr_url, vt_data.data0, vt_headers.data0);
        hr = unsafe {
            (*p_web_browser).Navigate(bstr_url, &vt_empty, &vt_empty, &vt_data, &vt_headers)
        };
    }

    unsafe {
        if !bstr_url.is_null() {
            SysFreeString(bstr_url);
        }
        if !bstr_headers.is_null() {
            SysFreeString(bstr_headers);
        }
        VariantClear(&mut vt_empty);
        VariantClear(&mut vt_data);
        VariantClear(&mut vt_headers);
    };

    if SUCCEEDED(hr) {
        let mut init_size = WindowSize { height: 0, width: 0 };
        let min_size = WindowSize { height: 768, width: 1024 };
        unsafe {
            (*p_web_browser).get_Height(&mut init_size.height);
            (*p_web_browser).get_Width(&mut init_size.width);
            // eprintln!("original window size: {}", init_size);
            (*p_web_browser).put_Height(cmp::max(init_size.height, min_size.height));
            (*p_web_browser).put_Width(cmp::max(init_size.width, min_size.width));
        };

        hr = unsafe { (*p_web_browser).put_Visible(VARIANT_TRUE) };
    }

    unsafe {
        if !p_web_browser.is_null() {
            (*p_web_browser).Release();
        }
        CoUninitialize();
    };

    if SUCCEEDED(hr) {
        Ok(hr)
    } else {
        Err(hr)
    }
}
