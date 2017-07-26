#![allow(dead_code, non_snake_case, non_upper_case_globals)]

pub use winapi::{BSTR, HRESULT, LONG, VARIANT};
use winapi::{IDispatch, INT, SHANDLE_PTR, VARIANT_BOOL};

// from um/ExDisp.h
DEFINE_GUID!{CLSID_InternetExplorer,
    0x0002df01, 0x0000, 0x0000, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}
DEFINE_GUID!{IID_IWebBrowser2,
    0xd30c1661, 0xcdaf, 0x11d0, 0x8a, 0x3e, 0x00, 0xc0, 0x4f, 0xc9, 0xe2, 0x6e}

// from um/DocObj.h
ENUM!{enum OLECMDEXECOPT { 
    OLECMDEXECOPT_DODEFAULT       = 0,
    OLECMDEXECOPT_PROMPTUSER      = 1,
    OLECMDEXECOPT_DONTPROMPTUSER  = 2,
    OLECMDEXECOPT_SHOWHELP        = 3,
}}

ENUM!{enum OLECMDF { 
    OLECMDF_SUPPORTED          = 0x1,
    OLECMDF_ENABLED            = 0x2,
    OLECMDF_LATCHED            = 0x4,
    OLECMDF_NINCHED            = 0x8,
    OLECMDF_INVISIBLE          = 0x10,
    OLECMDF_DEFHIDEONCTXTMENU  = 0x20,
}}

ENUM!{enum OLECMDID { 
    OLECMDID_OPEN                            = 1,
    OLECMDID_NEW                             = 2,
    OLECMDID_SAVE                            = 3,
    OLECMDID_SAVEAS                          = 4,
    OLECMDID_SAVECOPYAS                      = 5,
    OLECMDID_PRINT                           = 6,
    OLECMDID_PRINTPREVIEW                    = 7,
    OLECMDID_PAGESETUP                       = 8,
    OLECMDID_SPELL                           = 9,
    OLECMDID_PROPERTIES                      = 10,
    OLECMDID_CUT                             = 11,
    OLECMDID_COPY                            = 12,
    OLECMDID_PASTE                           = 13,
    OLECMDID_PASTESPECIAL                    = 14,
    OLECMDID_UNDO                            = 15,
    OLECMDID_REDO                            = 16,
    OLECMDID_SELECTALL                       = 17,
    OLECMDID_CLEARSELECTION                  = 18,
    OLECMDID_ZOOM                            = 19,
    OLECMDID_GETZOOMRANGE                    = 20,
    OLECMDID_UPDATECOMMANDS                  = 21,
    OLECMDID_REFRESH                         = 22,
    OLECMDID_STOP                            = 23,
    OLECMDID_HIDETOOLBARS                    = 24,
    OLECMDID_SETPROGRESSMAX                  = 25,
    OLECMDID_SETPROGRESSPOS                  = 26,
    OLECMDID_SETPROGRESSTEXT                 = 27,
    OLECMDID_SETTITLE                        = 28,
    OLECMDID_SETDOWNLOADSTATE                = 29,
    OLECMDID_STOPDOWNLOAD                    = 30,
    OLECMDID_ONTOOLBARACTIVATED              = 31,
    OLECMDID_FIND                            = 32,
    OLECMDID_DELETE                          = 33,
    OLECMDID_HTTPEQUIV                       = 34,
    OLECMDID_HTTPEQUIV_DONE                  = 35,
    OLECMDID_ENABLE_INTERACTION              = 36,
    OLECMDID_ONUNLOAD                        = 37,
    OLECMDID_PROPERTYBAG2                    = 38,
    OLECMDID_PREREFRESH                      = 39,
    OLECMDID_SHOWSCRIPTERROR                 = 40,
    OLECMDID_SHOWMESSAGE                     = 41,
    OLECMDID_SHOWFIND                        = 42,
    OLECMDID_SHOWPAGESETUP                   = 43,
    OLECMDID_SHOWPRINT                       = 44,
    OLECMDID_CLOSE                           = 45,
    OLECMDID_ALLOWUILESSSAVEAS               = 46,
    OLECMDID_DONTDOWNLOADCSS                 = 47,
    OLECMDID_UPDATEPAGESTATUS                = 48,
    OLECMDID_PRINT2                          = 49,
    OLECMDID_PRINTPREVIEW2                   = 50,
    OLECMDID_SETPRINTTEMPLATE                = 51,
    OLECMDID_GETPRINTTEMPLATE                = 52,
    OLECMDID_PAGEACTIONBLOCKED               = 55,
    OLECMDID_PAGEACTIONUIQUERY               = 56,
    OLECMDID_FOCUSVIEWCONTROLS               = 57,
    OLECMDID_FOCUSVIEWCONTROLSQUERY          = 58,
    OLECMDID_SHOWPAGEACTIONMENU              = 59,
    OLECMDID_ADDTRAVELENTRY                  = 60,
    OLECMDID_UPDATETRAVELENTRY               = 61,
    OLECMDID_UPDATEBACKFORWARDSTATE          = 62,
    OLECMDID_OPTICAL_ZOOM                    = 63,
    OLECMDID_OPTICAL_GETZOOMRANGE            = 64,
    OLECMDID_WINDOWSTATECHANGED              = 65,
    OLECMDID_ACTIVEXINSTALLSCOPE             = 66,
    OLECMDID_UPDATETRAVELENTRY_DATARECOVERY  = 67,
    OLECMDID_SHOWTASKDLG                     = 68,
    OLECMDID_POPSTATEEVENT                   = 69,
    OLECMDID_VIEWPORT_MODE                   = 70,
    OLECMDID_LAYOUT_VIEWPORT_WIDTH           = 71,
    OLECMDID_VISUAL_VIEWPORT_EXCLUDE_BOTTOM  = 72,
    OLECMDID_USER_OPTICAL_ZOOM               = 73,
    OLECMDID_PAGEAVAILABLE                   = 74,
    OLECMDID_GETUSERSCALABLE                 = 75,
    OLECMDID_UPDATE_CARET                    = 76,
    OLECMDID_ENABLE_VISIBILITY               = 77,
    OLECMDID_MEDIA_PLAYBACK                  = 78,
    OLECMDID_SETFAVICON                      = 79,
    OLECMDID_SET_HOST_FULLSCREENMODE         = 80,
    OLECMDID_EXITFULLSCREEN                  = 81,
    OLECMDID_SCROLLCOMPLETE                  = 82,
    OLECMDID_ONBEFOREUNLOAD                  = 83,
    OLECMDID_SHOWMESSAGE_BLOCKABLE           = 84,
    OLECMDID_SHOWTASKDLG_BLOCKABLE           = 85,
}}

// from um/OCIdl.h
ENUM!{enum READYSTATE {
    READYSTATE_UNINITIALIZED = 0,
    READYSTATE_LOADING       = 1,
    READYSTATE_LOADED        = 2,
    READYSTATE_INTERACTIVE   = 3,
    READYSTATE_COMPLETE      = 4,
}}

// from um/ExDisp.h
RIDL!(
interface IWebBrowser2(IWebBrowser2Vtbl): IDispatch(IDispatchVtbl) {
    // starts with IWebBrowser, doesn't work if defined separately
    fn GoBack(
        &mut self
    ) -> HRESULT,
    fn GoForward(
        &mut self
    ) -> HRESULT,
    fn GoHome(
        &mut self
    ) -> HRESULT,
    fn GoSearch(
        &mut self
    ) -> HRESULT,
    fn Navigate(
        &mut self, URL: BSTR, Flags: *const VARIANT, TargetFrameName: *const VARIANT,
        PostData: *const VARIANT, Headers: *const VARIANT
    ) -> HRESULT,
    fn Refresh(
        &mut self
    ) -> HRESULT,
    fn Refresh2(
        &mut self, Level: *const VARIANT
    ) -> HRESULT,
    fn Stop(
        &mut self
    ) -> HRESULT,
    fn get_Application(
        &mut self, ppDisp: *mut *mut IDispatch
    ) -> HRESULT,
    fn get_Parent(
        &mut self, ppDisp: *mut *mut IDispatch
    ) -> HRESULT,
    fn get_Container(
        &mut self, ppDisp: *mut *mut IDispatch
    ) -> HRESULT,
    fn get_Document(
        &mut self, ppDisp: *mut *mut IDispatch
    ) -> HRESULT,
    fn get_TopLevelContainer(
        &mut self, pBool: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn get_Type(
        &mut self, Type: *mut BSTR
    ) -> HRESULT,
    fn get_Left(
        &mut self, pl: *mut LONG
    ) -> HRESULT,
    fn put_Left(
        &mut self, Left: LONG
    ) -> HRESULT,
    fn get_Top(
        &mut self, pl: *mut LONG
    ) -> HRESULT,
    fn put_Top(
        &mut self, Top: LONG
    ) -> HRESULT,
    fn get_Width(
        &mut self, pl: *mut LONG
    ) -> HRESULT,
    fn put_Width(
        &mut self, Width: LONG
    ) -> HRESULT,
    fn get_Height(
        &mut self, pl: *mut LONG
    ) -> HRESULT,
    fn put_Height(
        &mut self, Height: LONG
    ) -> HRESULT,
    fn get_LocationName(
        &mut self, LocationName: *mut BSTR
    ) -> HRESULT,
    fn get_LocationURL(
        &mut self, LocationURL: *mut BSTR
    ) -> HRESULT,
    fn get_Busy(
        &mut self, pBool: *mut VARIANT_BOOL
    ) -> HRESULT,
    // and then IWebBrowserApp
    fn Quit(
        &mut self
    ) -> HRESULT,
    fn ClientToWindow(
        &mut self, pcx: *mut INT, pcy: *mut INT
    ) -> HRESULT,
    fn PutProperty(
        &mut self, Property: BSTR, vtValue: VARIANT
    ) -> HRESULT,
    fn GetProperty(
        &mut self, Property: BSTR, pvtValue: *mut VARIANT
    ) -> HRESULT,
    fn get_Name(
        &mut self, Name: *mut BSTR
    ) -> HRESULT,
    fn get_HWND(
        &mut self, pHWND: *mut SHANDLE_PTR
    ) -> HRESULT,
    fn get_FullName(
        &mut self, FullName: *mut BSTR
    ) -> HRESULT,
    fn get_Path(
        &mut self, Path: *mut BSTR
    ) -> HRESULT,
    fn get_Visible(
        &mut self, pBool: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_Visible(
        &mut self, Value: VARIANT_BOOL
    ) -> HRESULT,
    fn get_StatusBar(
        &mut self, pBool: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_StatusBar(
        &mut self, Value: VARIANT_BOOL
    ) -> HRESULT,
    fn get_StatusText(
        &mut self, StatusText: *mut BSTR
    ) -> HRESULT,
    fn put_StatusText(
        &mut self, StatusText: BSTR
    ) -> HRESULT,
    fn get_ToolBar(
        &mut self, Value: *mut INT
    ) -> HRESULT,
    fn put_ToolBar(
        &mut self, Value: INT
    ) -> HRESULT,
    fn get_MenuBar(
        &mut self, Value: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_MenuBar(
        &mut self, Value: VARIANT_BOOL
    ) -> HRESULT,
    fn get_FullScreen(
        &mut self, pbFullScreen: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_FullScreen(
        &mut self, bFullScreen: VARIANT_BOOL
    ) -> HRESULT,
    // and finally IWebBrowser2
    fn Navigate2(
        &mut self, URL: *const VARIANT, Flags: *const VARIANT, TargetFrameName: *const VARIANT,
        PostData: *const VARIANT, Headers: *const VARIANT
    ) -> HRESULT,
    fn QueryStatusWB(
        &mut self, cmdID: OLECMDID, pcmdf: *mut OLECMDF
    ) -> HRESULT,
    fn ExecWB(
        &mut self, cmdID: OLECMDID, cmdexecopt: OLECMDEXECOPT, pvaIn: *const VARIANT,
        pvaOut: *mut VARIANT
    ) -> HRESULT,
    fn ShowBrowserBar(
        &mut self, pvaClsid: *const VARIANT, pvarShow: *const VARIANT, pvarSize: *const VARIANT
    ) -> HRESULT,
    fn get_ReadyState(
        &mut self, plReadyState: *mut READYSTATE
    ) -> HRESULT,
    fn get_Offline(
        &mut self, pbOffline: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_Offline(
        &mut self, bOffline: VARIANT_BOOL
    ) -> HRESULT,
    fn get_Silent(
        &mut self, pbSilent: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_Silent(
        &mut self, bSilent: VARIANT_BOOL
    ) -> HRESULT,
    fn get_RegisterAsBrowser(
        &mut self, pbRegister: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_RegisterAsBrowser(
        &mut self, bRegister: VARIANT_BOOL
    ) -> HRESULT,
    fn get_RegisterAsDropTarget(
        &mut self, pbRegister: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_RegisterAsDropTarget(
        &mut self, bRegister: VARIANT_BOOL
    ) -> HRESULT,
    fn get_TheaterMode(
        &mut self, pbRegister: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_TheaterMode(
        &mut self, bRegister: VARIANT_BOOL
    ) -> HRESULT,
    fn get_AddressBar(
        &mut self, Value: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_AddressBar(
        &mut self, Value: VARIANT_BOOL
    ) -> HRESULT,
    fn get_Resizable(
        &mut self, Value: *mut VARIANT_BOOL
    ) -> HRESULT,
    fn put_Resizable(
        &mut self, Value: VARIANT_BOOL
    ) -> HRESULT
}
);

// from shared/wtypes.h
pub const VARIANT_TRUE: VARIANT_BOOL = -1;
