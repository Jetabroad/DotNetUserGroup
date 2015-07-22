using System;
using System.Drawing.Imaging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenQA.Selenium.Firefox;
using OpenQA.Selenium;

namespace MySeleniumTests
{
    [TestClass]
    public class UnitTests
    {
        [TestMethod]
        public void TestMethod1()
        {
            var driver = new FirefoxDriver();
            try
            {
                driver.Navigate().GoToUrl("http://docs.seleniumhq.org/oops");
                driver.FindElement(By.Id("q")).Click();
                driver.Keyboard.SendKeys("Hello World!");
                driver.Keyboard.PressKey(Keys.Enter);
            }
            catch (Exception e)
            {
                var ss = driver.GetScreenshot(); 
                ss.SaveAsFile("failed-test-case.png", ImageFormat.Png);
                driver.Close();
                throw;
            }
        }
    }
}
