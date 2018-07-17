/*
 * Based on
 * https://support.microsoft.com/kb/167658 and
 * https://github.com/Microsoft/Windows-classic-samples/blob/8f31b1ff79d6/
 *     Samples/Win7Samples/multimedia/mediafoundation/protectedplayback/WebHelper.cpp
 */

extern crate winapi;

use std::os::windows::ffi::OsStrExt;
use std::{cmp, ffi, fmt, mem, ptr};

use winapi::shared::minwindef::{DWORD, HKEY};
use winapi::shared::winerror::{
    ERROR_FILE_NOT_FOUND, ERROR_SUCCESS, E_OUTOFMEMORY, NOERROR, SUCCEEDED,
};
use winapi::shared::wtypes::{VT_UI1, BSTR, VARIANT_TRUE, VT_ARRAY, VT_BSTR};
use winapi::um::combaseapi::{CoCreateInstance, CoUninitialize, CLSCTX_SERVER};
use winapi::um::exdisp::{CLSID_InternetExplorer, IID_IWebBrowser2, IWebBrowser2};
use winapi::um::oaidl::VARIANT;
use winapi::um::objbase::CoInitialize;
use winapi::um::oleauto::{
    SafeArrayAccessData, SafeArrayCreateVector, SafeArrayUnaccessData, SysAllocString,
    SysFreeString, VariantClear, VariantInit,
};
use winapi::um::winnt::{
    KEY_WOW64_32KEY, KEY_WOW64_64KEY, HRESULT, KEY_ENUMERATE_SUB_KEYS, KEY_QUERY_VALUE,
    KEY_SET_VALUE, LONG, LPSTR,
};
use winapi::um::winreg::{RegCloseKey, RegDeleteTreeW, RegOpenKeyExW, HKEY_CURRENT_USER, REGSAM};

struct WindowSize {
    height: LONG,
    width: LONG,
}

impl fmt::Display for WindowSize {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}x{}", self.width, self.height)
    }
}

fn str_to_wstr(input: &str) -> Vec<u16> {
    ffi::OsStr::new(input)
        .encode_wide()
        .chain(Some(0))
        .collect()
}

// ffi related ownership concerns?
fn remove_hkcu_clsid_ie(registry_node: REGSAM) {
    let sub_key = str_to_wstr("SOFTWARE\\Classes\\CLSID");
    // is this the minimal necessary samDesired ? what about DELETE ?
    let sam_desired = KEY_ENUMERATE_SUB_KEYS | KEY_QUERY_VALUE | KEY_SET_VALUE | registry_node;
    let mut hkey: HKEY = ptr::null_mut();

    match unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            sub_key.as_ptr(),
            0,
            sam_desired,
            &mut hkey,
        )
    } as DWORD
    {
        ERROR_SUCCESS => (),
        ret => eprintln!("RegOpenKeyExW returns: {}", ret),
    };

    if hkey.is_null() {
        return;
    }

    // hard-coded, no stringFromCLSID yet
    let sub_key = str_to_wstr("{0002DF01-0000-0000-C000-000000000046}");
    match unsafe { RegDeleteTreeW(hkey, sub_key.as_ptr()) } as DWORD {
        ERROR_FILE_NOT_FOUND => (),
        ERROR_SUCCESS => eprintln!("RegDeleteTreeW succeeded"),
        ret => eprintln!("RegDeleteTreeW returns: {}", ret),
    };

    match unsafe { RegCloseKey(hkey) } as DWORD {
        ERROR_SUCCESS => (),
        ret => eprintln!("RegCloseKey returns: {}", ret),
    };
}

fn init_web_browser(p_web_browser: &mut *mut IWebBrowser2) -> HRESULT {
    let hr = unsafe {
        CoCreateInstance(
            &CLSID_InternetExplorer,
            ptr::null_mut(),
            CLSCTX_SERVER,
            &IID_IWebBrowser2,
            // p_web_browser as *mut *mut IWebBrowser2 as *mut LPVOID)
            p_web_browser as *mut _ as *mut _,
        )
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

    // VARTYPE, ULONG
    let psa = unsafe { SafeArrayCreateVector(VT_UI1 as _, 0, byte_count as _) };
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
        unsafe {
            output.n1.n2_mut().vt = (VT_ARRAY | VT_UI1) as _;
            *output.n1.n2_mut().n3.parray_mut() = psa;
        }
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

    let mut vt_empty: VARIANT = unsafe { mem::uninitialized() };
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
        unsafe {
            vt_headers.n1.n2_mut().vt = VT_BSTR as _;
            *vt_headers.n1.n2_mut().n3.bstrVal_mut() = bstr_headers;
        }
    }

    if SUCCEEDED(hr) {
        if !body.is_empty() {
            hr = init_vt_data(&mut vt_data, body);
        }
    }

    if SUCCEEDED(hr) {
        // unsafe {
        //     eprintln!("url: {:p}, vt_data: {}, vt_headers: {}",
        //         bstr_url, vt_data.n1.n2().vt, vt_headers.n1.n2().vt);
        // }
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
        let mut init_size = WindowSize {
            height: 0,
            width: 0,
        };
        let min_size = WindowSize {
            height: 768,
            width: 1024,
        };
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
