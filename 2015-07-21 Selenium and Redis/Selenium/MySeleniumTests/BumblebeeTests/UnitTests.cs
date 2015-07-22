using System;
using System.Linq;
using System.Runtime.InteropServices;
using Bumblebee.Extensions;
using Bumblebee.Setup;
using Bumblebee.Setup.DriverEnvironments;
using BumblebeeTests.Components;
using BumblebeeTests.Pages;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenQA.Selenium;
using OpenQA.Selenium.Firefox;

namespace BumblebeeTests
{
    [TestClass]
    public class UnitTests
    {
        [TestMethod]
        public void GenericPage_CanClickAllTheMenuLinks()
        {
            Threaded<Session>.With<Chrome>().NavigateTo<HomePage>(HomePage.Url)
                .ProjectsNavigationLink().Click()
                .DownloadNavigationLink().Click()
                .DocumentationNavigationLink().Click()
                .SupportNavigationLink().Click()
                .AboutNavigationLink().Click()
                .Verify("the about page title exists",
                    page => page.GetElement(By.CssSelector("#mainContent h2")).Text == "About Selenium");
        }

        [TestMethod]
        public void HomePage_CanClickTheDownloadLink()
        {
            Threaded<Session>.With<Chrome>().NavigateTo<HomePage>(HomePage.Url)
                .DownloadButton().Click()
                .Verify("we're on the download page",
                    page => page.GetElement(By.CssSelector("#mainContent h2")).Text == "Downloads");
        }

        [TestMethod]
        public void SupportPage_CanClickTheDownloadLink()
        {
            Threaded<Session>.With<Chrome>().NavigateTo<SupportPage>(SupportPage.Url)
                .DownloadButton().Click()
                .Verify("we're on the download page",
                    page => page.GetElement(By.CssSelector("#mainContent h2")).Text == "Downloads");
        }

        [TestMethod]
        public void HomePage_CanGetToDownloadPageFromSearchResults()
        {
            Threaded<Session>.With<Chrome>().NavigateTo<HomePage>(HomePage.Url)
                .SearchFor("Downloads")
                .SearchResults().First().Click()
                .Verify("we're on the download page",
                    page => page.GetElement(By.CssSelector("#mainContent h2")).Text == "Downloads");
        }

        [TestCleanup]
        public void Cleanup()
        {
            Threaded<Session>.End();
        }
    }
}
